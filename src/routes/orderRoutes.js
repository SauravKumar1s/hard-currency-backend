import express from 'express';
import Order from '../models/Order.js';

const router = express.Router();

// @desc    Create new order (No authentication required)
// @route   POST /api/orders/create
// @access  Public
router.post('/create', async (req, res) => {
  try {
    const {
      orderReference,
      customerInfo,
      orderItems,
      orderSummary,
      orderStatus,
      orderType
    } = req.body;

    console.log('📦 Creating new order:', { orderReference, customerInfo: customerInfo.email });

    // Validate required fields
    if (!orderReference || !customerInfo || !orderItems || !orderSummary) {
      return res.status(400).json({
        success: false,
        message: 'Missing required order fields'
      });
    }

    // Check if order reference already exists
    const existingOrder = await Order.findOne({ orderReference });
    if (existingOrder) {
      return res.status(400).json({
        success: false,
        message: 'Order reference already exists'
      });
    }

    // Create new order (no user field required)
    const order = new Order({
      orderReference,
      customerInfo,
      orderItems,
      orderSummary,
      orderStatus: orderStatus || 'pending_contact',
      orderType: orderType || 'manual_payment'
    });

    await order.save();

    console.log('✅ Order created successfully:', order.orderReference);

    res.status(201).json({
      success: true,
      message: 'Order created successfully. Our team will contact you soon.',
      order: order
    });

  } catch (error) {
    console.error('❌ Order creation error:', error);
    
    // Handle duplicate key errors
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Order reference already exists'
      });
    }

    // Handle validation errors
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: errors
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error creating order',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// @desc    Get all orders (for admin - you can add basic auth later)
// @route   GET /api/orders
// @access  Public (for now, add auth later for admin panel)
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const orders = await Order.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalOrders = await Order.countDocuments();

    res.json({
      success: true,
      orders: orders,
      pagination: {
        current: page,
        pages: Math.ceil(totalOrders / limit),
        total: totalOrders
      }
    });
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching orders'
    });
  }
});

// @desc    Get single order
// @route   GET /api/orders/:id
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    res.json({
      success: true,
      order: order
    });
  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching order'
    });
  }
});

// @desc    Update order status (for admin)
// @route   PUT /api/orders/:id/status
// @access  Public (add auth later for admin)
router.put('/:id/status', async (req, res) => {
  try {
    const { orderStatus, adminNotes } = req.body;

    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Update order status
    order.orderStatus = orderStatus || order.orderStatus;
    
    // Add admin notes if provided
    if (adminNotes) {
      order.adminNotes = adminNotes;
    }

    // Add to contact history if status is being updated to contacted
    if (orderStatus === 'contacted') {
      order.contactHistory.push({
        contactDate: new Date(),
        method: 'phone',
        notes: 'Initial contact made with customer',
        adminUser: 'Admin'
      });
    }

    await order.save();

    res.json({
      success: true,
      message: 'Order status updated successfully',
      order: order
    });
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating order status'
    });
  }
});

// @desc    Add contact history to order
// @route   POST /api/orders/:id/contact
// @access  Public (add auth later for admin)
router.post('/:id/contact', async (req, res) => {
  try {
    const { method, notes } = req.body;

    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    order.contactHistory.push({
      contactDate: new Date(),
      method: method || 'phone',
      notes: notes,
      adminUser: 'Admin'
    });

    // Update order status to contacted if it's the first contact
    if (order.orderStatus === 'pending_contact') {
      order.orderStatus = 'contacted';
    }

    await order.save();

    res.json({
      success: true,
      message: 'Contact history added successfully',
      order: order
    });
  } catch (error) {
    console.error('Add contact history error:', error);
    res.status(500).json({
      success: false,
      message: 'Error adding contact history'
    });
  }
});

// @desc    Get orders by status
// @route   GET /api/orders/status/:status
// @access  Public
router.get('/status/:status', async (req, res) => {
  try {
    const { status } = req.params;
    const validStatuses = [
      'pending_contact', 'contacted', 'confirmed', 'preparing', 
      'ready_for_shipping', 'shipped', 'delivered', 'cancelled'
    ];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order status'
      });
    }

    const orders = await Order.find({ orderStatus: status })
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      orders: orders,
      count: orders.length
    });
  } catch (error) {
    console.error('Get orders by status error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching orders by status'
    });
  }
});

// @desc    Get order statistics (for admin dashboard)
// @route   GET /api/orders/stats/dashboard
// @access  Public
router.get('/stats/dashboard', async (req, res) => {
  try {
    const totalOrders = await Order.countDocuments();
    const pendingContactOrders = await Order.countDocuments({ orderStatus: 'pending_contact' });
    const confirmedOrders = await Order.countDocuments({ orderStatus: 'confirmed' });
    const shippedOrders = await Order.countDocuments({ orderStatus: 'shipped' });
    
    // Total revenue
    const revenueResult = await Order.aggregate([
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$orderSummary.totalAmount' }
        }
      }
    ]);

    const totalRevenue = revenueResult.length > 0 ? revenueResult[0].totalRevenue : 0;

    // Recent orders
    const recentOrders = await Order.find()
      .sort({ createdAt: -1 })
      .limit(5);

    res.json({
      success: true,
      stats: {
        totalOrders,
        pendingContactOrders,
        confirmedOrders,
        shippedOrders,
        totalRevenue: parseFloat(totalRevenue.toFixed(2))
      },
      recentOrders
    });
  } catch (error) {
    console.error('Get order stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching order statistics'
    });
  }
});

export default router;