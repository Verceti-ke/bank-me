import { AuthService } from './../auth/auth.service';
import { Http, Headers } from '@angular/http';
import { environment } from './../../../environments/environment';
import { Injectable, NgZone } from '@angular/core';
import { StorageService } from '../storage/storage.service';
import * as moment from 'moment';
import 'rxjs/add/operator/toPromise';
declare var Plaid: any;

@Injectable({
  providedIn: 'root'
})
export class BankingService {
  host: string;
  headers: Headers;

  constructor(public http: Http, public storageService: StorageService,
    public ngZone: NgZone, public authService: AuthService) {
    if (!environment.production) {
      this.host = 'http://localhost:8080';
    } else {
      this.host = '';
    }

    this.headers = new Headers();
    this.headers.append('Content-Type', 'application/json');
    this.headers.append('Access-Control-Allow-Origin', '*');
  }

  launchPlaidService() {
    const hasPlaidAccess = this.hasPlaidAccess();
    const self = this;
    if (hasPlaidAccess) {
      return Promise.resolve(true);
    }
    return new Promise((resolve, reject) => {
      const handler = Plaid.create({
        apiVersion: 'v2',
        clientName: 'Bank Me',
        env: environment.plaidConfig.env,
        product: ['auth', 'transactions'],
        key: environment.plaidConfig.publicKey,
        onSuccess: function (public_token) {
          return self.authService.userToken()
            .then(token => {

              if (token) {
                self.headers.set('Authorization', `Bearer ${token}`);
                return self.http.post(self.host + '/api/get_access_token', { public_token: public_token }, {
                  headers: self.headers
                })
                  .toPromise()
                  .then(data => {
                    data = data.json();
                    if (data['error']) {
                      console.error(data['error']);
                      reject(data['error']);
                    }
                    self.setPlaidToken(data);
                    resolve(true);
                  });
              }
            });
        },
        onExit: this.handleError
      });
      handler.open();
    });
  }

  getBankAccounts() {
    return new Promise((resolve, reject) => {
      if (this.hasPlaidAccess()) {

        return this.authService.userToken()
          .then(token => {

            if (token) {
              this.headers.set('Authorization', `Bearer ${token}`);
              this.http.post(this.host + '/api/accounts', { access_token: this.plaidAccess.access_token }, {
                headers: this.headers
              })
                .toPromise()
                .then(data => {
                  data = data.json();
                  resolve(data);
                });
            }
          });
      } else {
        resolve(null);
      }
    });
  }

  getBankTransactions(from, to) {
    let fromClone = Object.assign({}, from);
    let toClone = Object.assign({}, to);
    fromClone.month -= 1;
    toClone.month -= 1;
    fromClone = moment(fromClone).format('YYYY-MM-DD');
    toClone = moment(toClone).format('YYYY-MM-DD');

    return new Promise((resolve, reject) => {
      if (this.hasPlaidAccess()) {
        return this.authService.userToken()
          .then(token => {

            if (token) {
              this.headers.set('Authorization', `Bearer ${token}`);
              const body = JSON.stringify({
                access_token: this.plaidAccess.access_token,
                from: fromClone,
                to: toClone
              });
              this.http.post(this.host + '/api/transactions', body, {
                headers: this.headers
              })
                .toPromise()
                .then(data => {
                  resolve(data.json());
                });
            }
          });

      } else {
        resolve(null);
      }
    });
  }

  hasPlaidAccess() {
    const plaid = this.plaidAccess;

    return plaid.access_token && plaid.item_id;
  }

  get plaidAccess() {
    return {
      access_token: this.storageService.getInLocal('plaid_access_token'),
      item_id: this.storageService.getInLocal('plaid_item_id')
    };
  }

  setPlaidToken(data) {
    this.storageService.setInLocal('plaid_item_id', data.item_id);
    return this.storageService.setInLocal('plaid_access_token', data.access_token);
  }

  deleteAccess() {
    this.storageService.removeInLocal('plaid_item_id');
    this.storageService.removeInLocal('plaid_access_token');
    return Promise.resolve("done");
  }

  private handleError(error: any) {
    const errMsg = (error.message) ? error.message :
      error.status ? `${error.status} - ${error.statusText}` : 'Server error';
    console.error(errMsg); // log to console instead
  }
}
