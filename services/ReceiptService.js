const PDFDocument = require('pdfkit');
const OrderService = require('./OrderService');

class ReceiptService {
  constructor() {
    this.orderService = new OrderService();
  }

  async generateReceiptPDF(orderId) {
    try {
      // Get order details
      const orderDetails = await this.orderService.getOrderWithDetails(orderId);
      
      if (!orderDetails) {
        throw new Error('Order not found');
      }

      // Create PDF document
      const doc = new PDFDocument({ margin: 50 });
      
      // Add content to PDF
      this.addHeader(doc);
      this.addOrderInfo(doc, orderDetails);
      this.addCustomerInfo(doc, orderDetails);
      this.addLineItems(doc, orderDetails);
      this.addTotals(doc, orderDetails);
      this.addFooter(doc);

      // Finalize PDF
      doc.end();
      
      return doc;
    } catch (error) {
      console.error('Error generating receipt PDF:', error);
      throw error;
    }
  }

  addHeader(doc) {
    doc.fontSize(20)
       .text('Equipment Rental Receipt', 50, 50);
    
    doc.fontSize(12)
       .text('Equipment Rental Management System', 50, 80);
    
    // Add current date
    doc.text(`Generated: ${new Date().toLocaleString()}`, 400, 80, { align: 'right' });
    
    // Add line under header
    doc.moveTo(50, 110)
       .lineTo(550, 110)
       .stroke();
  }

  addOrderInfo(doc, orderDetails) {
    let yPos = 130;
    
    doc.fontSize(14)
       .text('Order Information', 50, yPos);
    
    yPos += 25;
    
    doc.fontSize(11)
       .text(`Order ID: #${orderDetails.id}`, 50, yPos)
       .text(`Status: ${orderDetails.status}`, 300, yPos);
    
    yPos += 20;
    
    doc.text(`Start Date: ${new Date(orderDetails.startDate).toLocaleDateString()}`, 50, yPos)
       .text(`Return Due: ${new Date(orderDetails.returnDueDate).toLocaleDateString()}`, 300, yPos);
    
    yPos += 20;
    
    doc.text(`Rental Period: ${orderDetails.rentalDays} days`, 50, yPos);
    
    if (orderDetails.salesPersonName) {
      doc.text(`Sales Person: ${orderDetails.salesPersonName}`, 300, yPos);
    }
    
    return yPos + 30;
  }

  addCustomerInfo(doc, orderDetails) {
    let yPos = 220;
    
    doc.fontSize(14)
       .text('Customer Information', 50, yPos);
    
    yPos += 25;
    
    doc.fontSize(11);
    
    if (orderDetails.customerName) {
      doc.text(`Customer: ${orderDetails.customerName}`, 50, yPos);
      yPos += 15;
    }
    
    if (orderDetails.customerOrganization) {
      doc.text(`Organization: ${orderDetails.customerOrganization}`, 50, yPos);
      yPos += 15;
    }
    
    return yPos + 20;
  }

  addLineItems(doc, orderDetails) {
    let yPos = 300;
    
    doc.fontSize(14)
       .text('Order Items', 50, yPos);
    
    yPos += 25;
    
    // Table headers
    doc.fontSize(10)
       .text('Item', 50, yPos)
       .text('SKU', 250, yPos)
       .text('Qty', 320, yPos)
       .text('Price/Day', 360, yPos)
       .text('Days', 430, yPos)
       .text('Total', 480, yPos);
    
    // Line under headers
    yPos += 15;
    doc.moveTo(50, yPos)
       .lineTo(550, yPos)
       .stroke();
    
    yPos += 10;
    
    // Add line items
    for (const item of orderDetails.lineItems || []) {
      if (yPos > 700) { // Start new page if needed
        doc.addPage();
        yPos = 50;
      }
      
      doc.fontSize(9)
         .text(item.item_name || 'Unknown Item', 50, yPos, { width: 190 })
         .text(item.item_sku || 'N/A', 250, yPos)
         .text(item.quantity?.toString() || '0', 320, yPos)
         .text(`$${(item.price_per_day || 0).toFixed(2)}`, 360, yPos)
         .text(orderDetails.rentalDays?.toString() || '0', 430, yPos)
         .text(`$${(item.line_total || 0).toFixed(2)}`, 480, yPos);
      
      yPos += 20;
    }
    
    return yPos + 20;
  }

  addTotals(doc, orderDetails) {
    let yPos = doc.page.height - 200; // Position from bottom
    
    // Line above totals
    doc.moveTo(350, yPos)
       .lineTo(550, yPos)
       .stroke();
    
    yPos += 15;
    
    doc.fontSize(11);
    
    // Subtotal
    doc.text('Subtotal:', 350, yPos)
       .text(`$${(orderDetails.subtotal || 0).toFixed(2)}`, 480, yPos);
    
    yPos += 20;
    
    // Discount (if any)
    if (orderDetails.discountAmount > 0) {
      doc.text('Discount:', 350, yPos)
         .text(`-$${orderDetails.discountAmount.toFixed(2)}`, 480, yPos);
      yPos += 20;
    }
    
    // Tax (if any)
    if (orderDetails.taxAmount > 0) {
      doc.text('Tax:', 350, yPos)
         .text(`$${orderDetails.taxAmount.toFixed(2)}`, 480, yPos);
      yPos += 20;
    }
    
    // Total line
    doc.moveTo(350, yPos)
       .lineTo(550, yPos)
       .stroke();
    
    yPos += 15;
    
    // Total
    doc.fontSize(14)
       .text('Total:', 350, yPos)
       .text(`$${(orderDetails.total || 0).toFixed(2)}`, 480, yPos);
  }

  addFooter(doc) {
    const yPos = doc.page.height - 100;
    
    doc.fontSize(8)
       .text('Thank you for your business!', 50, yPos)
       .text('Equipment Rental Management System', 50, yPos + 15);
    
    // Add generation timestamp at bottom
    doc.text(`Receipt generated on ${new Date().toLocaleString()}`, 350, yPos + 15, { 
      align: 'right' 
    });
  }

  // Get receipt as buffer for API responses
  async generateReceiptBuffer(orderId) {
    return new Promise((resolve, reject) => {
      try {
        const doc = this.generateReceiptPDF(orderId);
        const chunks = [];
        
        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);
        
      } catch (error) {
        reject(error);
      }
    });
  }
}

module.exports = ReceiptService;