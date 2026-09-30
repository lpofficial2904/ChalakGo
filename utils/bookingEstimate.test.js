import test from 'node:test';
import assert from 'node:assert/strict';
import nodemailer from 'nodemailer';
import SiteSettings from '../models/SiteSettings.js';
import { sendBookingEmail, sendCustomerBookingEmail } from './mailer.js';
import { formatBookingEstimate } from './bookingEstimate.js';

test('estimate formatting preserves zero, Indian grouping and missing amounts', () => {
  assert.equal(formatBookingEstimate({ totalFare: 123456.5 }), 'Rs. 1,23,456.5');
  assert.equal(formatBookingEstimate({ totalFare: 0 }), 'Rs. 0');
  assert.equal(formatBookingEstimate({}), 'Not calculated');
  assert.equal(formatBookingEstimate({ totalFare: NaN }), 'Not calculated');
  assert.equal(formatBookingEstimate({ tourPlanPrice: 'Rs. 2,000' }), 'Rs. 2,000');
});

test('admin and customer emails include the saved estimate in text and HTML', async (t) => {
  const messages = [];
  t.mock.method(SiteSettings, 'findOne', () => ({
    lean: async () => ({ smtpUser: 'sender@example.test', smtpPass: 'test', smtpHost: 'smtp.example.test', bookingEmail: 'admin@example.test', customerBookingEmailMessage: 'Your estimate is {{fare}}.' }),
  }));
  t.mock.method(nodemailer, 'createTransport', () => ({
    sendMail: async message => { messages.push(message); return {}; },
  }));
  for (const totalFare of [1450, 0, undefined]) {
    const booking = { bookingId: 'TEST-1', fullName: 'Test Customer', service: 'Driver Only', totalFare };
    await sendBookingEmail(booking);
    await sendCustomerBookingEmail(booking, 'customer@example.test');
    const estimate = formatBookingEstimate(booking);
    for (const message of messages.slice(-2)) {
      assert.ok(message.text.includes('TOTAL ESTIMATE: ' + estimate));
      assert.ok(message.html.includes('TOTAL ESTIMATE'));
      assert.ok(message.html.includes(estimate));
    }
  }
});
