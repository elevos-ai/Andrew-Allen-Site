const { statsHandler } = require("../../lib/stats-handler");

const createResponseAdapter = () => {
  const headers = {};

  return {
    headers,
    statusCode: 200,
    body: "",
    setHeader(name, value) {
      headers[name] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      headers["Content-Type"] = "application/json";
      this.body = JSON.stringify(payload);
      return this;
    },
  };
};

exports.handler = async (event) => {
  const req = {
    method: event.httpMethod,
    headers: event.headers,
    query: event.queryStringParameters || {},
  };
  const res = createResponseAdapter();

  await statsHandler(req, res);

  return {
    statusCode: res.statusCode,
    headers: res.headers,
    body: res.body,
  };
};
