// wrapper for fetch http requests, provide header and instance details for N8N.
const $http = {
  createHeaders: (INSTANCE) => {
    return {
      headers: {
        accept: "application/json",
        "X-N8N-API-KEY": INSTANCE.API_KEY,
      },
    };
  },
  get: async (INSTANCE, endpoint) => {
    return fetch(`${INSTANCE.URL}/${endpoint}`, {
      ...$http.createHeaders(INSTANCE),
      method: "GET",
    }).then((res) => {
      return res.json();
    });
  },
  post: async (INSTANCE, endpoint, payload) => {
    return fetch(`${INSTANCE.URL}/${endpoint}`, {
      ...$http.createHeaders(INSTANCE),
      method: "POST",
      body: payload,
    }).then((res) => {
      return res.json();
    });
  },
};

export { $http };
