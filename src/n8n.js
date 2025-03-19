import { $http } from "./http.js";

const n8n = {
  get: {
    projects: (INSTANCE, limit) => {
      return $http.get(INSTANCE, `api/v1/projects?limit=${limit}`);
    },
    users: (INSTANCE, limit) => {
      return $http.get(
        INSTANCE,
        `api/v1/users?limit=${limit}&includeRole=true`,
      );
    },
    workflows: (INSTANCE, limit) => {
      return $http.get(
        INSTANCE,
        `api/v1/workflows?limit=${limit}&excludePinnedData=true`,
      );
    },
  },
};

export { n8n };
