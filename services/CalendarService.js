const { calendarTokenRepository, orderRepository } = require('../repositories');

class CalendarService {
  constructor() {
    this.calendarTokenRepository = calendarTokenRepository;
    this.orderRepository = orderRepository;
    this.cache = new Map();
    this.cacheTimeout = 2 * 60 * 1000; // 2 minutes in milliseconds
  }

  // Generate ICS calendar feed
  async generateICSFeed(token) {
    try {
      // Check cache first
      const cacheKey = `ics_${token}`;
      const cached = this.cache.get(cacheKey);
      
      if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.data;
      }

      // Validate token
      const tokenData = await this.calendarTokenRepository.findByToken(token);
      if (!tokenData) {
        throw new Error('Invalid calendar token');
      }

      // Update last used timestamp
      await this.calendarTokenRepository.updateLastUsed(token);

      // Get calendar events for the next year
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 1); // Include past month
      
      const endDate = new Date();
      endDate.setFullYear(endDate.getFullYear() + 1); // Include next year

      const events = await this.orderRepository.getCalendarEvents(
        startDate.toISOString().split('T')[0],
        endDate.toISOString().split('T')[0]
      );

      // Generate ICS content
      const icsContent = this.generateICS(events);

      // Cache the result
      this.cache.set(cacheKey, {
        data: icsContent,
        timestamp: Date.now()
      });

      return icsContent;
    } catch (error) {
      console.error('Error generating ICS feed:', error);
      throw error;
    }
  }

  async getInternalSchedule(start, end) {
    const startDate = start ? new Date(start) : new Date();
    const endDate = end ? new Date(end) : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    const events = await this.orderRepository.getInternalEvents(
      startDate.toISOString(),
      endDate.toISOString()
    );

    const blocks = [];
    for (const ev of events) {
      if (ev.setup_start) {
        blocks.push({
          orderId: ev.id,
          type: 'Setup',
          start: ev.setup_start,
          end: ev.order_start,
          customer: ev.customer_name,
          status: ev.status,
        });
      }
      blocks.push({
        orderId: ev.id,
        type: 'Order',
        start: ev.order_start,
        end: ev.order_end,
        customer: ev.customer_name,
        status: ev.status,
      });
      if (ev.cleanup_end) {
        blocks.push({
          orderId: ev.id,
          type: 'Cleanup',
          start: ev.order_end,
          end: ev.cleanup_end,
          customer: ev.customer_name,
          status: ev.status,
        });
      }
    }
    return blocks;
  }

  generateICS(events) {
    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Equipment Rental Management//Equipment Calendar//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH'
    ];

    for (const event of events) {
      const startDate = new Date(event.start_date);
      const endDate = new Date(event.return_due_date);
      
      // Format dates as YYYYMMDD
      const formatDate = (date) => {
        return date.toISOString().split('T')[0].replace(/-/g, '');
      };

      // Determine event color/category based on status
      const categoryMap = {
        'Draft': 'GRAY',
        'Reserved': 'YELLOW', 
        'Checked Out': 'RED',
        'Returned': 'GREEN',
        'Cancelled': 'BLACK'
      };

      const category = categoryMap[event.status] || 'GRAY';

      lines.push(
        'BEGIN:VEVENT',
        `UID:order-${event.id}@equipment-rental.local`,
        `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
        `DTSTART;VALUE=DATE:${formatDate(startDate)}`,
        `DTEND;VALUE=DATE:${formatDate(new Date(endDate.getTime() + 24 * 60 * 60 * 1000))}`, // Add 1 day for end date
        `SUMMARY:Equipment Rental - ${event.customer_name}`,
        `DESCRIPTION:Order #${event.id}\\n` +
        `Customer: ${event.customer_name}\\n` +
        `Status: ${event.status}\\n` +
        `Items: ${event.items || 'Multiple items'}\\n` +
        `Order Total: $${(event.total_amount || 0).toFixed(2)}\\n` +
        `Sales Person: ${event.sales_person_name || 'N/A'}\\n` +
        `Return Due: ${endDate.toLocaleDateString()}`,
        `CATEGORIES:${category}`,
        `TRANSP:TRANSPARENT`,
        'END:VEVENT'
      );
    }

    lines.push('END:VCALENDAR');
    return lines.join('\r\n');
  }

  // Create new calendar token
  async createToken(description, createdBy) {
    try {
      const tokenData = await this.calendarTokenRepository.generateToken(description, createdBy);
      return tokenData;
    } catch (error) {
      console.error('Error creating calendar token:', error);
      throw error;
    }
  }

  // Get all active tokens
  async getActiveTokens() {
    try {
      return await this.calendarTokenRepository.getActiveTokens();
    } catch (error) {
      console.error('Error getting active tokens:', error);
      throw error;
    }
  }

  // Revoke token
  async revokeToken(tokenId) {
    try {
      // Clear from cache
      const tokens = await this.calendarTokenRepository.getActiveTokens();
      const token = tokens.find(t => t.id === parseInt(tokenId));
      if (token) {
        this.cache.delete(`ics_${token.token}`);
      }

      return await this.calendarTokenRepository.revokeToken(tokenId);
    } catch (error) {
      console.error('Error revoking token:', error);
      throw error;
    }
  }

  // Get token usage statistics
  async getTokenStats() {
    try {
      return await this.calendarTokenRepository.getTokenUsageStats();
    } catch (error) {
      console.error('Error getting token stats:', error);
      throw error;
    }
  }

  // Clear cache manually
  clearCache() {
    this.cache.clear();
  }

  // Invalidate cache for specific token
  invalidateTokenCache(token) {
    this.cache.delete(`ics_${token}`);
  }

  // Clean up old cache entries
  cleanupCache() {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > this.cacheTimeout) {
        this.cache.delete(key);
      }
    }
  }
}

module.exports = CalendarService;
