import { randomUUID } from 'node:crypto';
import Decimal from 'decimal.js';
import prisma from './prisma.js';
import { moveProductStock } from './stock.js';

const UNIT_ALIASES = {
  kg: { kg: 1, g: 0.001, gram: 0.001, grams: 0.001 },
  g: { g: 1, gram: 1, grams: 1, kg: 1000 },
  gram: { g: 1, gram: 1, grams: 1, kg: 1000 },
  grams: { g: 1, gram: 1, grams: 1, kg: 1000 },
  packet: { packet: 1, packets: 1 },
  packets: { packet: 1, packets: 1 },
  piece: { piece: 1, pieces: 1, pc: 1, pcs: 1 },
  pieces: { piece: 1, pieces: 1, pc: 1, pcs: 1 },
  pc: { piece: 1, pieces: 1, pc: 1, pcs: 1 },
  pcs: { piece: 1, pieces: 1, pc: 1, pcs: 1 },
};

const CUSTOMER_STATUS_MESSAGES = {
  ORDER_ACCEPTED: 'The producer accepted your order.',
  PRODUCTION_STARTED: 'Production has started for your order.',
  PRODUCTION_IN_PROGRESS: 'Production is in progress for your order.',
  QUALITY_CHECK: 'Your order is undergoing its quality check.',
  PRODUCTION_COMPLETED: 'Production is complete. Your seller invoice is ready.',
  READY_FOR_PACKAGING: 'Your order is ready for packaging.',
  READY_FOR_DISPATCH: 'Your order is ready for dispatch.',
  DISPATCHED: 'Your parcel has been dispatched.',
  DELIVERED: 'Your parcel has been delivered.',
  REJECTED: 'The producer could not accept your order.',
};

function unitFactor(baseUnit, requestedUnit) {
  const base = String(baseUnit || '').trim().toLowerCase();
  const requested = String(requestedUnit || baseUnit || '').trim().toLowerCase();
  if (base === requested) return 1;
  const factor = UNIT_ALIASES[base]?.[requested];
  if (!factor) throw new Error(`Unit "${requestedUnit}" is not compatible with product unit "${baseUnit}".`);
  return factor;
}

export async function createMarketplaceOrder(user, input) {
  const items = input.items;
  if (!Array.isArray(items) || items.length === 0) {
    const error = new Error('Add at least one product to the order.');
    error.status = 400;
    throw error;
  }
  if (typeof input.deliveryAddress !== 'string' || !input.deliveryAddress.trim()) {
    const error = new Error('A delivery address is required.');
    error.status = 400;
    throw error;
  }
  if (input.deliveryAddress.length > 300
    || (input.deliveryMethod !== undefined && (typeof input.deliveryMethod !== 'string' || input.deliveryMethod.length > 80))
    || (input.specialInstructions !== undefined && (typeof input.specialInstructions !== 'string' || input.specialInstructions.length > 1000))) {
    const error = new Error('Delivery details exceed the allowed length.');
    error.status = 400;
    throw error;
  }

  const result = await prisma.$transaction(async tx => {
    const customer = await tx.customer.findUnique({ where: { id: user.customerId } });
    if (!customer || !customer.isActive) {
      const error = new Error('Customer account is not linked to an active customer record.');
      error.status = 403;
      throw error;
    }

    const grouped = new Map();
    for (const item of items) {
      const productId = Number(item.productId);
      const displayQty = Number(item.quantity ?? item.orderedQty);
      if (!Number.isInteger(productId) || !Number.isFinite(displayQty) || displayQty <= 0) {
        const error = new Error('Each item must have a valid product and positive quantity.');
        error.status = 400;
        throw error;
      }
      if (item.unit !== undefined && typeof item.unit !== 'string') {
        const error = new Error('Each item unit must be a string.');
        error.status = 400;
        throw error;
      }

      const product = await tx.product.findFirst({
        where: { id: productId, isActive: true, isAvailable: true, sellerId: { not: null }, seller: { role: 'SELLER', isActive: true } },
        include: { seller: { select: { id: true, name: true } } },
      });
      if (!product) {
        const error = new Error('One or more selected products are unavailable.');
        error.status = 400;
        throw error;
      }
      let factor;
      try {
        factor = unitFactor(product.unit, item.unit);
      } catch (error) {
        error.status = 400;
        throw error;
      }
      const normalizedQty = new Decimal(displayQty).times(factor);
      const unitPrice = new Decimal(product.sellingPrice).times(factor);
      const totalPrice = unitPrice.times(displayQty);
      if (!normalizedQty.isFinite() || normalizedQty.lte(0) || !totalPrice.isFinite() || totalPrice.lt(0)) {
        const error = new Error('Order quantity or amount is invalid.');
        error.status = 400;
        throw error;
      }
      if (!grouped.has(product.sellerId)) grouped.set(product.sellerId, []);
      grouped.get(product.sellerId).push({
        product,
        orderedQty: normalizedQty.toNumber(),
        displayQty,
        unit: item.unit || product.unit,
        unitPrice: unitPrice.toNumber(),
        totalPrice: totalPrice.toNumber(),
      });
    }

    const reference = `BL-${randomUUID()}`;
    const subtotal = Array.from(grouped.values()).flat().reduce((sum, item) => sum + item.totalPrice, 0);
    const configuredCharge = await tx.systemConfig.findUnique({ where: { key: 'marketplace_delivery_charge' } });
    const deliveryCharge = Number(configuredCharge?.value ?? process.env.MARKETPLACE_DELIVERY_CHARGE ?? 0);
    if (!Number.isFinite(deliveryCharge) || deliveryCharge < 0) {
      throw new Error('Marketplace delivery charge configuration must be a non-negative number.');
    }
    const taxAmount = Array.from(grouped.values()).flat().reduce((sum, item) => {
      return sum + new Decimal(item.totalPrice).times(item.product.gstRate).dividedBy(100).toNumber();
    }, 0);
    const totalAmount = new Decimal(subtotal).plus(taxAmount).plus(deliveryCharge).toNumber();
    const address = input.deliveryAddress.trim();
    const marketplaceOrder = await tx.marketplaceOrder.create({
      data: {
        reference,
        customerId: customer.id,
        subtotal,
        taxAmount,
        deliveryCharge,
        totalAmount,
        deliveryAddress: address,
        deliveryMethod: input.deliveryMethod?.trim() || null,
      },
    });

    const sellerEntries = Array.from(grouped.entries());
    let allocatedCharge = 0;
    const sellerOrders = [];
    for (let index = 0; index < sellerEntries.length; index += 1) {
      const [sellerId, sellerItems] = sellerEntries[index];
      const sellerSubtotal = sellerItems.reduce((sum, item) => sum + item.totalPrice, 0);
      const sellerCharge = index === sellerEntries.length - 1
        ? new Decimal(deliveryCharge).minus(allocatedCharge).toNumber()
        : subtotal > 0 ? new Decimal(deliveryCharge).times(sellerSubtotal).dividedBy(subtotal).toDecimalPlaces(2).toNumber() : 0;
      allocatedCharge += sellerCharge;
      const orderNo = `MP-${randomUUID()}`;
      const order = await tx.order.create({
        data: {
          orderNo,
          customerId: customer.id,
          orderDate: new Date(),
          status: 'ORDER_RECEIVED',
          totalAmount: new Decimal(sellerSubtotal).plus(sellerCharge).toNumber(),
          deliveryCharge: sellerCharge,
          deliveryAddress: address,
          deliveryMethod: marketplaceOrder.deliveryMethod,
          specialInstructions: input.specialInstructions?.trim() || null,
          createdById: user.id,
          sellerId,
          marketplaceOrderId: reference,
          items: {
            create: sellerItems.map(item => ({
              productId: item.product.id,
              orderedQty: item.orderedQty,
              displayQty: item.displayQty,
              unit: item.unit,
              availableQty: 0,
              shortageQty: 0,
              unitPrice: item.unitPrice,
              totalPrice: item.totalPrice,
            })),
          },
          statusEvents: { create: { status: 'ORDER_RECEIVED' } },
        },
        include: {
          customer: true,
          seller: { select: { id: true, name: true } },
          items: { include: { product: true } },
          statusEvents: true,
        },
      });
      sellerOrders.push(order);
      await tx.notification.create({
        data: {
          userId: sellerId,
          orderId: order.id,
          marketplaceOrderReference: reference,
          type: 'ORDER_RECEIVED',
          title: 'New customer order',
          message: `${customer.name} placed order ${order.orderNo}.`,
        },
      });
    }

    await tx.notification.create({
      data: {
        userId: user.id,
        marketplaceOrderReference: reference,
        type: 'ORDER_PLACED',
        title: 'Order placed successfully',
        message: `Order ${reference} was placed successfully.`,
      },
    });
    await tx.auditLog.create({
      data: {
        userId: user.id,
        action: 'CREATE',
        entity: 'MarketplaceOrder',
        entityId: sellerOrders[0]?.id,
        newValues: JSON.stringify({ reference, sellerOrderIds: sellerOrders.map(order => order.id) }),
      },
    });

    return { ...marketplaceOrder, orders: sellerOrders };
  });
  return result;
}

const NEXT_STATUS = {
  ORDER_RECEIVED: ['ORDER_ACCEPTED', 'REJECTED'],
  PENDING_APPROVAL: ['ORDER_ACCEPTED', 'REJECTED'],
  ORDER_ACCEPTED: ['PRODUCTION_STARTED'],
  APPROVED: ['PRODUCTION_STARTED'],
  PRODUCTION_STARTED: ['PRODUCTION_IN_PROGRESS'],
  PRODUCTION_IN_PROGRESS: ['QUALITY_CHECK'],
  QUALITY_CHECK: ['PRODUCTION_COMPLETED', 'PRODUCTION_IN_PROGRESS'],
  PRODUCTION_COMPLETED: ['READY_FOR_PACKAGING'],
  READY_FOR_PACKAGING: ['READY_FOR_DISPATCH'],
  READY_FOR_DISPATCH: ['DISPATCHED'],
  DISPATCHED: ['DELIVERED'],
};

async function createSellerInvoice(tx, order) {
  const invoiceItems = [];
  let taxableAmount = new Decimal(0);
  let cgst = new Decimal(0);
  let sgst = new Decimal(0);
  let igst = new Decimal(0);
  const [configuredState, configuredStateCode] = await Promise.all([
    tx.systemConfig.findUnique({ where: { key: 'BUSINESS_STATE' } }),
    tx.systemConfig.findUnique({ where: { key: 'BUSINESS_STATE_CODE' } }),
  ]);
  const sellerState = order.seller?.businessState || configuredState?.value || 'Tamil Nadu';
  const sellerStateCode = order.seller?.businessStateCode || configuredStateCode?.value;
  const isInterState = sellerStateCode && order.customer.stateCode
    ? sellerStateCode !== order.customer.stateCode
    : sellerState !== order.customer.state;
  for (const item of order.items) {
    const baseAmount = new Decimal(item.totalPrice);
    const rate = new Decimal(item.product.gstRate);
    const itemCgst = isInterState ? new Decimal(0) : baseAmount.times(rate).dividedBy(200);
    const itemSgst = isInterState ? new Decimal(0) : baseAmount.times(rate).dividedBy(200);
    const itemIgst = isInterState ? baseAmount.times(rate).dividedBy(100) : new Decimal(0);
    taxableAmount = taxableAmount.plus(baseAmount);
    cgst = cgst.plus(itemCgst);
    sgst = sgst.plus(itemSgst);
    igst = igst.plus(itemIgst);
    invoiceItems.push({
      productId: item.productId,
      quantity: item.displayQty ?? item.orderedQty,
      unitPrice: item.unitPrice,
      unit: item.unit,
      taxableAmount: baseAmount.toNumber(),
      gstRate: item.product.gstRate,
      cgst: itemCgst.toNumber(),
      sgst: itemSgst.toNumber(),
      igst: itemIgst.toNumber(),
      totalAmount: baseAmount.plus(itemCgst).plus(itemSgst).plus(itemIgst).toNumber(),
    });
  }
  const totalGst = cgst.plus(sgst).plus(igst);
  const grandTotal = taxableAmount.plus(totalGst).plus(order.deliveryCharge);
  return tx.invoice.create({
    data: {
      invoiceNo: `MP-INV-${randomUUID()}`,
      orderId: order.id,
      customerId: order.customerId,
      invoiceDate: new Date(),
      status: 'POSTED',
      taxableAmount: taxableAmount.toNumber(),
      cgst: cgst.toNumber(),
      sgst: sgst.toNumber(),
      igst: igst.toNumber(),
      totalGst: totalGst.toNumber(),
      grandTotal: grandTotal.toNumber(),
      deliveryCharge: order.deliveryCharge,
      isInterState,
      amountDue: grandTotal.toNumber(),
      paymentStatus: 'UNPAID',
      createdById: order.sellerId,
      items: { create: invoiceItems },
    },
  });
}

export async function updateSellerOrderStatus(user, orderId, status, note, delivery = {}) {
  return prisma.$transaction(async tx => {
    const order = await tx.order.findFirst({
      where: { id: orderId, sellerId: user.id, marketplaceOrderId: { not: null } },
      include: {
        customer: true,
        seller: { select: { businessState: true, businessStateCode: true } },
        items: { include: { product: true } },
        marketplaceOrder: true,
      },
    });
    if (!order) return null;
    if (!NEXT_STATUS[order.status]?.includes(status)) {
      const error = new Error(`Cannot change order status from ${order.status} to ${status}.`);
      error.status = 409;
      throw error;
    }

    if (status === 'PRODUCTION_STARTED') {
      const quantities = new Map();
      for (const item of order.items) {
        quantities.set(item.productId, (quantities.get(item.productId) || 0) + item.orderedQty);
      }
      for (const [productId, plannedOutput] of quantities) {
        const existingRun = await tx.productionRun.findFirst({ where: { orderId: order.id, productId } });
        if (existingRun) continue;
        const bom = await tx.bom.findFirst({
          where: {
            productId,
            isActive: true,
            items: {
              some: { material: { sellerId: user.id } },
              every: { material: { sellerId: user.id } },
            },
          },
          orderBy: { version: 'desc' },
        });
        if (!bom) {
          const error = new Error('Assign seller-owned raw materials and an active bill of materials before starting production.');
          error.status = 409;
          throw error;
        }
        await tx.productionRun.create({
          data: {
            batchNo: `MP-${order.id}-${productId}-${randomUUID().slice(0, 8)}`,
            bomId: bom.id,
            productId,
            plannedOutput,
            productionDate: new Date(),
            supervisorId: user.id,
            orderId: order.id,
            status: 'IN_PROGRESS',
            notes: `Marketplace order ${order.orderNo}`,
          },
        });
      }
    }
    if (status === 'PRODUCTION_COMPLETED') {
      const unfinishedRuns = await tx.productionRun.count({
        where: { orderId: order.id, status: { not: 'COMPLETED' } },
      });
      const linkedRuns = await tx.productionRun.count({ where: { orderId: order.id } });
      if (!linkedRuns || unfinishedRuns) {
        const error = new Error('Complete the linked ERP production run before marking this order production-complete.');
        error.status = 409;
        throw error;
      }
    }

    const updateData = { status };
    if (delivery.trackingReference !== undefined) updateData.trackingReference = delivery.trackingReference?.trim() || null;
    if (delivery.deliveryMethod !== undefined) updateData.deliveryMethod = delivery.deliveryMethod?.trim() || null;
    await tx.order.update({ where: { id: order.id }, data: updateData });
    await tx.orderStatusEvent.create({ data: { orderId: order.id, status, note: note?.trim() || null } });

    let invoice = null;
    if (status === 'PRODUCTION_COMPLETED') {
      const existing = await tx.invoice.findFirst({ where: { orderId: order.id, status: 'POSTED' } });
      invoice = existing || await createSellerInvoice(tx, order);
    }
    if (status === 'DISPATCHED') {
      const invoiceForDispatch = await tx.invoice.findFirst({ where: { orderId: order.id, status: 'POSTED' } });
      if (!invoiceForDispatch) {
        const error = new Error('A posted seller invoice is required before dispatch.');
        error.status = 409;
        throw error;
      }
      const dispatchNo = `MP-DSP-${randomUUID()}`;
      const dispatch = await tx.dispatch.create({
        data: {
          dispatchNo,
          orderId: order.id,
          invoiceId: invoiceForDispatch.id,
          dispatchDate: new Date(),
          deliveryMethod: delivery.deliveryMethod || order.deliveryMethod,
          trackingReference: delivery.trackingReference || order.trackingReference,
          notes: note?.trim() || null,
          items: { create: order.items.map(item => ({ productId: item.productId, quantity: item.orderedQty })) },
        },
      });
      for (const item of order.items) {
        await moveProductStock({
          productId: item.productId,
          qty: -item.orderedQty,
          movementType: 'SALE',
          referenceId: invoiceForDispatch.id,
          referenceType: 'Invoice',
          notes: `Marketplace dispatch ${dispatch.dispatchNo}`,
        }, tx);
      }
    }
    const message = CUSTOMER_STATUS_MESSAGES[status];
    if (message) {
      await tx.notification.create({
        data: {
          userId: order.createdById,
          orderId: order.id,
          marketplaceOrderReference: order.marketplaceOrderId,
          type: status,
          title: status.replaceAll('_', ' '),
          message: `${message} Seller: ${user.name}.`,
        },
      });
    }

    await tx.auditLog.create({
      data: {
        userId: user.id,
        action: 'UPDATE',
        entity: 'Order',
        entityId: order.id,
        oldValues: JSON.stringify({ status: order.status }),
        newValues: JSON.stringify({ status, trackingReference: delivery.trackingReference || null }),
      },
    });

    const siblingOrders = await tx.order.findMany({
      where: { marketplaceOrderId: order.marketplaceOrderId },
      select: { status: true },
    });
    const allDelivered = siblingOrders.every(entry => entry.status === 'DELIVERED');
    const allRejected = siblingOrders.every(entry => entry.status === 'REJECTED');
    const allTerminal = siblingOrders.every(entry => ['DELIVERED', 'REJECTED'].includes(entry.status));
    const hasDelivered = siblingOrders.some(entry => entry.status === 'DELIVERED');
    await tx.marketplaceOrder.update({
      where: { reference: order.marketplaceOrderId },
      data: {
        status: allDelivered ? 'DELIVERED' : allRejected ? 'REJECTED' : allTerminal && hasDelivered ? 'PARTIALLY_FULFILLED' : 'IN_PROGRESS',
      },
    });

    return { order: { ...order, status }, invoice };
  });
}

export async function getCustomerMarketplaceOrders(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { customerId: true } });
  if (!user?.customerId) return [];
  return prisma.marketplaceOrder.findMany({
    where: { customerId: user.customerId },
    include: {
      orders: {
        include: {
          seller: { select: { id: true, name: true } },
          items: { include: { product: true } },
          statusEvents: { orderBy: { createdAt: 'asc' } },
          invoices: { include: { customer: true, items: { include: { product: true } } } },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}
