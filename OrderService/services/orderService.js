const Order = require('../models/Order');

class OrderService {
    async getAllOrders() {
        try {
            return await Order.find();
        } catch (error) {
            throw new Error('Error fetching orders: ' + error.message);
        }
    }

    async getOrdersByUser(userId) {
        try {
            return await Order.find({ userId });
        } catch (error) {
            throw new Error('Error fetching user orders: ' + error.message);
        }
    }

    async getOrderById(id) {
        try {
            const order = await Order.findById(id);
            if (!order) {
                throw new Error('Order not found');
            }
            return order;
        } catch (error) {
            throw new Error('Error fetching order: ' + error.message);
        }
    }

    async createOrder(orderData) {
        try {
            const order = new Order(orderData);
            return await order.save();
        } catch (error) {
            throw new Error('Error creating order: ' + error.message);
        }
    }

    async updateOrderStatus(id, status) {
        try {
            const order = await Order.findById(id);
            if (!order) {
                throw new Error('Order not found');
            }
            order.status = status;
            order.updatedAt = Date.now();
            return await order.save();
        } catch (error) {
            throw new Error('Error updating order status: ' + error.message);
        }
    }

    async updatePaymentStatus(id, paymentStatus) {
        try {
            const order = await Order.findById(id);
            if (!order) {
                throw new Error('Order not found');
            }
            order.paymentStatus = paymentStatus;
            order.updatedAt = Date.now();
            return await order.save();
        } catch (error) {
            throw new Error('Error updating payment status: ' + error.message);
        }
    }
}

module.exports = new OrderService(); 