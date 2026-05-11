const { withRetry } = require('../utils/retry');

async function processPayment(paymentDetails) {
  return withRetry(async () => {
    const response = await stripe.paymentIntents.create({
      amount: paymentDetails.amount,
      currency: 'usd',
      payment_method: paymentDetails.methodId,
      confirm: true,
    });
    return response;
  }, 5, 2000);
}

module.exports = { processPayment };
