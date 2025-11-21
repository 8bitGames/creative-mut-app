const express = require("express");
const got = require("got");
const uuid = require("uuid").v4;
const router = express.Router();
const crypto = require('crypto');

const clientId = 'S2_af4543a0be4d49a98122e01ec2059a56';
const secretKey = '9eb85607103646da9f9c02b128f2e5ee';
const key = secretKey.substring(0, 32);
const iv = secretKey.substring(0, 16);

router.get("/", function (req, res) {
  res.render("regist", {
    orderId: uuid()
  });
});

router.post("/regist", function (req, res) {
  const plainText = "cardNo="+ req.body.cardNo 
                  + "&expYear=" + req.body.expYear
                  + "&expMonth="+ req.body.expMonth 
                  + "&idNo=" + req.body.idNo 
                  + "&cardPw="+ req.body.cardPw
  
  got.post("https://sandbox-api.nicepay.co.kr/v1/subscribe/regist", {
      headers: {
        Authorization: 
          "Basic " + Buffer.from(clientId + ":" + secretKey).toString("base64"), 
          "Content-Type": "application/json"
      },
      json: {
        encData: encrypt(plainText, key, iv),
        orderId: uuid(),
        encMode: 'A2'
      },
      responseType: "json",
    })
    .then(function (response) {
      console.log(response.body);
      // 비즈니스 로직 구현

      // billing(response.body.bid)

      res.render("response", {
        resultMsg: response.body.resultMsg
      });
    })
    .catch(function (error) {
      console.log(error);

    });
});


var billing = ((bid) => {
  got.post("https://sandbox-api.nicepay.co.kr/v1/subscribe/"+bid+"/payments", {
    headers: {
      Authorization: 
        "Basic " + Buffer.from(clientId + ":" + secretKey).toString("base64"), 
        "Content-Type": "application/json"
    },
    json: {
      orderId: uuid(),
      amount: 1004,
      goodsName: "card billing test",
      cardQuota: 0,
      useShopInterest: false
    },
    responseType: "json",
  })
  .then(function (response) {
    console.log(response.body);
    // 결제 비즈니스 로직 구현

  })
  .catch(function (error) {
    console.log(error);
  
  });
});


var expire = ((bid) => {
  got.post("https://sandbox-api.nicepay.co.kr/v1/subscribe/"+bid+"/expire", {
    headers: {
      Authorization: 
        "Basic " + Buffer.from(clientId + ":" + secretKey).toString("base64"), 
        "Content-Type": "application/json"
    },
    json: {
      orderId: uuid()
    },
    responseType: "json",
  })
  .then(function (response) {
    console.log(response.body);
    // 비즈니스 로직 구현

  })
  .catch(function (error) {
    console.log(error);
  
  });
});

var encrypt = ((text, key, iv) => {
  let cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(key), iv);
  let encrypted = cipher.update(text);
  return Buffer.concat([encrypted, cipher.final()]).toString('hex');
});

module.exports = router;