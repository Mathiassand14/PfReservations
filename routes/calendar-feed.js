const CalendarService = require('../services/CalendarService');

const calendarService = new CalendarService();

// GET /calendar.ics?token=... - ICS calendar feed endpoint
async function handleCalendarFeed(req, res) {
  try {
    const { token } = req.query;
    
    if (!token) {
      return res.status(400).json({
        error: {
          code: 'MISSING_TOKEN',
          message: 'Calendar token is required'
        }
      });
    }

    // Generate ICS feed
    const icsContent = await calendarService.generateICSFeed(token);
    
    // Set appropriate headers for ICS file
    res.set({
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="equipment-rental-calendar.ics"',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    
    res.send(icsContent);
  } catch (error) {
    console.error('Error generating calendar feed:', error);
    
    if (error.message === 'Invalid calendar token') {
      return res.status(401).json({
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid calendar token'
        }
      });
    }
    
    res.status(500).json({
      error: {
        code: 'CALENDAR_ERROR',
        message: 'Failed to generate calendar feed'
      }
    });
  }
}

module.exports = handleCalendarFeed;