const { default: axios } = require('axios');

class TenantService {
  /**
   * Consumes api that returns tenants data
   *
   * @param {string} tenantsRouteUrl Url for api that returns data about tenants
   */
  constructor(tenantsRouteUrl) {
    this.tenantsRouteUrl = tenantsRouteUrl;
    this.axios = axios.create({
      timeout: 12000,
    });
  }

  /**
   * Requires tenant data for API
   *
   * @param {string} tenant the tenant name
   *
   * @returns a list of tenants
   */
  async getTenants() {
    const tenants = await this.axios.get(this.tenantsRouteUrl);

    return tenants.data.tenants;
  }
}

module.exports = TenantService;
