const express = require('express');
const router = express.Router();
const CalendarService = require('../services/CalendarService');
const { asyncHandler, requireAdminToken } = require('../middleware/auth');

const calendarService = new CalendarService();

// GET /api/calendar/tokens - Get all active calendar tokens
router.get('/tokens', requireAdminToken, asyncHandler(async (req, res) => {
  const tokens = await calendarService.getActiveTokens();
  res.json({
    tokens,
    count: tokens.length
  });
}));

// GET /api/calendar/stats - Get token usage statistics
router.get('/stats', asyncHandler(async (req, res) => {
  const stats = await calendarService.getTokenStats();
  res.json({ stats });
}));

// POST /api/calendar/tokens - Create new calendar token
router.post('/tokens', requireAdminToken, asyncHandler(async (req, res) => {
  const { description, createdBy = 'API User' } = req.body;
  
  if (!description) {
    return res.status(400).json({
      error: {
        code: 'MISSING_DESCRIPTION',
        message: 'Token description is required'
      }
    });
  }

  const token = await calendarService.createToken(description, createdBy);
  res.status(201).json({
    ...token,
    feedUrl: `${req.protocol}://${req.get('host')}/calendar.ics?token=${token.token}`
  });
}));

// DELETE /api/calendar/tokens/:id - Revoke calendar token
router.delete('/tokens/:id', requireAdminToken, asyncHandler(async (req, res) => {
  const deletedToken = await calendarService.revokeToken(req.params.id);
  
  if (!deletedToken) {
    return res.status(404).json({
      error: {
        code: 'TOKEN_NOT_FOUND',
        message: 'Calendar token not found'
      }
    });
  }

  res.json({
    message: 'Calendar token revoked successfully',
    token: deletedToken
  });
}));

// GET /api/calendar/internal - Internal schedule blocks (Setup/Order/Cleanup)
router.get('/internal', asyncHandler(async (req, res) => {
  const { start, end } = req.query;
  const blocks = await calendarService.getInternalSchedule(start, end);
  res.json({
    blocks,
    count: blocks.length,
    period: {
      start: start || null,
      end: end || null
    }
  });
}));

// POST /api/calendar/cache/clear - Clear calendar cache (admin only)
router.post('/cache/clear', requireAdminToken, asyncHandler(async (req, res) => {
  calendarService.clearCache();
  res.json({
    message: 'Calendar cache cleared successfully'
  });
}));

module.exports = router;
