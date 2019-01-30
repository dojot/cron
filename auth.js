"use strict";

function b64decode(data) {
  if (typeof Buffer.from === "function") {
    return Buffer.from(data, 'base64').toString();
  } else {
    return (new Buffer(data, 'base64')).toString();
  }
}

class UnauthorizedError {
  constructor(){
    this.message = "Authentication (JWT) required for API";
  }
}

class InvalidTokenError {
  constructor(){
    this.message = "Invalid authentication token given";
  }
}

function authParse(req, res, next) {
  const rawToken = req.get('authorization');
  if (rawToken === undefined) {
    return next();
  }

  const token = rawToken.split('.');
  if (token.length !== 3) {
    console.error("Got invalid request: token is malformed", rawToken);
    return res.status(401).send(new InvalidTokenError());
  }

  const tokenData = JSON.parse(b64decode(token[1]));

  req.user = tokenData.username;
  req.userid = tokenData.userid;
  req.service = tokenData.service;
  next();
}

function authEnforce(req, res, next) {
  if (req.path.match(/(\.png|svg$)|(keymap\.json$)/)){
    console.log('will ignore ', req.path);
    return next();
  }

  if (req.user === undefined || req.user.trim() === "" ) {
    // valid token must be supplied
    console.error("Got invalid request: user is not defined in token: ", req.get('authorization'));
    return res.status(401).send(new UnauthorizedError());
  }

  if (req.service === undefined || req.service.trim() === "" ) {
    // valid token must be supplied
    return res.status(401).send(new UnauthorizedError());
  }

  next();
}

module.exports = {
  authParse: authParse,
  authEnforce: authEnforce
};
