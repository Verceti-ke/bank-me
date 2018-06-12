'use strict';

require('dotenv').config();

const moment = require('moment');
const plaid = require('plaid');

const PLAID_CLIENT_ID = process.env.PLAID_CLIENT_ID;
const PLAID_SECRET = process.env.PLAID_SECRET;
const PLAID_PUBLIC_KEY = process.env.PLAID_PUBLIC_KEY;
const PLAID_ENV = process.env.PLAID_ENV || 'development';

// We store the access_token in memory - in production, store it in a secure
// persistent data store
var ACCESS_TOKEN = process.env.ACCESS_TOKEN;
var PUBLIC_TOKEN = null;
var ITEM_ID = process.env.ITEM_ID;

// Initialize the Plaid client
const client = new plaid.Client(
  PLAID_CLIENT_ID,
  PLAID_SECRET,
  PLAID_PUBLIC_KEY,
  plaid.environments[PLAID_ENV]
);

module.exports = {
  init: (request, response) => {
    response.send("API is live");
    // response.render('index.ejs', {
    //   PLAID_PUBLIC_KEY: PLAID_PUBLIC_KEY,
    //   PLAID_ENV: PLAID_ENV,
    // });
  },
  getAccessToken: (request, response) => {
    PUBLIC_TOKEN = request.body.public_token;
    client.exchangePublicToken(PUBLIC_TOKEN, function (error, tokenResponse) {
      if (error != null) {
        var msg = 'Could not exchange public_token!';
        console.log(msg + '\n' + JSON.stringify(error));
        return response.json({
          error: msg
        });
      }
      ACCESS_TOKEN = tokenResponse.access_token;
      ITEM_ID = tokenResponse.item_id;
      
      response.json({
        'error': false
      });
    });
  },
  getAccounts: (request, response) => {
    // Retrieve high-level account information and account and routing numbers
    // for each account associated with the Item.
    return client.getAuth(ACCESS_TOKEN)
      .then(authResponse => {
        response.json({
          error: false,
          accounts: authResponse.accounts,
          numbers: authResponse.numbers,
        });
      })
      .catch(error => {
        var msg = 'Unable to pull accounts from the Plaid API.';
        console.log(msg + '\n' + JSON.stringify(error));
        return response.json({
          error: msg
        });
      });
  },
  getTransactions: (date) => {
    // Pull transactions for the Item for the last 30 days
    var daysInMonth = moment(date).daysInMonth() - 1;
    var endDate = moment(date).add(daysInMonth, 'days').format('YYYY-MM-DD');
    var startDate = moment(date).format('YYYY-MM-DD');

    return client.getTransactions(ACCESS_TOKEN, startDate, endDate, {
        count: 500
      })
      .then(transactionsResponse => {
        return transactionsResponse.transactions;
      })
      .catch(error => {
        console.log(JSON.stringify(error));
        return response.json({
          error: error
        });
      })
  }
}