const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const Report = require('../models/Report');
const User = require('../models/User');

// Middleware to check if user is admin - this should eventually be in its own file
const requireAdmin = async (req, res, next) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user || !user.isAdmin) {
            return res.status(403).json({ msg: 'Access denied: Admin privileges required' });
        }
        next();
    } catch (err) {
        res.status(500).json({ msg: 'Server error during admin check' });
    }
};

// @route   GET /api/reports
// @desc    Get all reports (for admins)
// @access  Admin
router.get('/', [auth, requireAdmin], async (req, res) => {
    try {
        const reports = await Report.find()
            .populate('reporter', 'username email')
            .populate('reported', 'username email')
            .populate('resolvedBy', 'username')
            .sort({ createdAt: -1 });
        res.json(reports);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   PUT /api/reports/:id
// @desc    Update a report's status and notes (for admins)
// @access  Admin
router.put('/:id', [auth, requireAdmin], async (req, res) => {
    const { status, adminNotes } = req.body;
    try {
        const report = await Report.findById(req.params.id);
        if (!report) {
            return res.status(404).json({ msg: 'Report not found' });
        }

        if (status) report.status = status;
        if (adminNotes) report.adminNotes = adminNotes;
        if (status === 'Resolved') {
            report.resolvedBy = req.user.id;
        }

        await report.save();
        
        const populatedReport = await Report.findById(report._id)
            .populate('reporter', 'username email')
            .populate('reported', 'username email')
            .populate('resolvedBy', 'username');

        res.json(populatedReport);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;
