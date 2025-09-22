'use strict';

function roundToNext15Min(hours) {
  if (typeof hours !== 'number' || !isFinite(hours) || hours < 0) return 0;
  return Math.ceil(hours * 4) / 4;
}

function toDate(d) {
  return d instanceof Date ? d : new Date(d);
}

function hoursBetween(a, b) {
  const start = toDate(a).getTime();
  const end = toDate(b).getTime();
  return Math.max(0, (end - start) / (1000 * 60 * 60));
}

function calcDailyCount(orderStart, orderEnd) {
  const hours = hoursBetween(orderStart, orderEnd);
  if (hours <= 24) return 0;
  return Math.ceil((hours - 24) / 24);
}

module.exports = {
  roundToNext15Min,
  calcDailyCount,
  priceServiceLine,
  priceEquipmentLine,
  priceCompositeLine,
  calcOrderTotals,
};

function priceServiceLine({ hours = 0, rate = 0 }) {
  const billedHours = roundToNext15Min(hours);
  const total = +(billedHours * rate).toFixed(2);
  return { billedHours, rate, total };
}

function priceEquipmentLine({ start = 0, daily = 0, qty = 1, rebatePct = 0, orderStart, orderEnd }) {
  const dailyCount = calcDailyCount(orderStart, orderEnd);
  const startCost = (start || 0) * qty;
  const dailyCost = (daily || 0) * dailyCount * qty;
  const subtotal = startCost + dailyCost;
  const discount = +(subtotal * (rebatePct / 100)).toFixed(2);
  const total = +(subtotal - discount).toFixed(2);
  return { startCost, dailyCost, dailyCount, qty, rebatePct, subtotal: +subtotal.toFixed(2), discount, total };
}

function priceCompositeLine(components = [], orderStart, orderEnd, rebatePct = 0) {
  const sum = components.reduce((acc, c) => {
    const r = priceEquipmentLine({ ...c, rebatePct, orderStart, orderEnd });
    return acc + r.total;
  }, 0);
  return +sum.toFixed(2);
}

function calcOrderTotals(order = {}, lines = [], rebatePct = 0) {
  const orderStart = order.orderStart || order.order_start || order.start || order.startDate || order.start_time;
  const orderEnd = order.orderEnd || order.order_end || order.end || order.endDate || order.end_time;
  let equipmentTotal = 0;
  let servicesTotal = 0;
  const breakdown = [];

  for (const line of lines) {
    const type = line.type || line.line_type;
    if (type === 'Service') {
      const res = priceServiceLine({ hours: line.hours ?? 0, rate: line.rate ?? line.unit_price ?? 0 });
      servicesTotal += res.total;
      breakdown.push({ type: 'Service', ...res });
    } else if (type === 'Composite' && Array.isArray(line.components)) {
      const total = priceCompositeLine(line.components, orderStart, orderEnd, rebatePct);
      equipmentTotal += total;
      breakdown.push({ type: 'Composite', total });
    } else { // Equipment single item with start/daily/qty
      const res = priceEquipmentLine({
        start: line.start ?? 0,
        daily: line.daily ?? 0,
        qty: line.qty ?? line.quantity ?? 1,
        rebatePct,
        orderStart,
        orderEnd,
      });
      equipmentTotal += res.total;
      breakdown.push({ type: 'Equipment', ...res });
    }
  }

  equipmentTotal = +equipmentTotal.toFixed(2);
  servicesTotal = +servicesTotal.toFixed(2);
  const subtotal = +(equipmentTotal + servicesTotal).toFixed(2);
  const rebateAmount = +((equipmentTotal + servicesTotal) - (servicesTotal + equipmentTotal)).toFixed(2); // already applied in equipment totals
  const totalExVat = subtotal;

  return { equipmentTotal, servicesTotal, subtotal, rebateAmount, totalExVat, lines: breakdown };
}
