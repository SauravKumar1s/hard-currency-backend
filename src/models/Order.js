import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema({
  orderReference: {
    type: String,
    required: true,
    unique: true
  },
  // Remove the required user field since we're collecting all info in form
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null // Make it optional
  },
  customerInfo: {
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    address: { type: String, required: true },
    city: { type: String, required: true },
    province: { type: String, required: true },
    postalCode: { type: String, required: true },
    country: { type: String, default: 'Canada' },
    specialInstructions: { type: String, default: '' },
    preferredContact: { 
      type: String, 
      enum: ['email', 'phone', 'whatsapp'],
      default: 'email'
    }
  },
  orderItems: [{
    productId: { type: String, required: true },
    name: { type: String, required: true },
    quantity: { type: Number, required: true },
    price: { type: Number, required: true },
    originalPrice: { type: Number },
    discountPercentage: { type: Number },
    size: { type: String, default: 'Not specified' },
    color: { type: String, default: 'Not specified' },
    image: { type: String }
  }],
  orderSummary: {
    subtotal: { type: Number, required: true },
    discountAmount: { type: Number, default: 0 },
    shippingFee: { type: Number, required: true },
    totalAmount: { type: Number, required: true },
    promoCode: { type: String },
    itemsCount: { type: Number, required: true }
  },
  orderStatus: {
    type: String,
    enum: [
      'pending_contact',
      'contacted', 
      'confirmed',
      'preparing',
      'ready_for_shipping',
      'shipped',
      'delivered',
      'cancelled'
    ],
    default: 'pending_contact'
  },
  orderType: {
    type: String,
    enum: ['manual_payment', 'online_payment'],
    default: 'manual_payment'
  },
  adminNotes: {
    type: String,
    default: ''
  },
  contactHistory: [{
    contactDate: { type: Date, default: Date.now },
    method: String,
    notes: String,
    adminUser: String
  }]
}, {
  timestamps: true
});

// Index for faster queries
orderSchema.index({ orderReference: 1 });
orderSchema.index({ 'customerInfo.email': 1 });
orderSchema.index({ orderStatus: 1 });
orderSchema.index({ createdAt: -1 });

export default mongoose.model('Order', orderSchema);