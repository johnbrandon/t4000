// Extends app.json. When EXPO_BASE_URL is set at build time (e.g. the GitHub
// Pages deploy uses "/t4000"), the web export is served from that sub-path;
// when unset (local dev, or hosting at a domain root) the app stays at "/".
module.exports = ({ config }) => {
  const baseUrl = process.env.EXPO_BASE_URL;
  return {
    ...config,
    experiments: {
      ...config.experiments,
      ...(baseUrl ? { baseUrl } : {}),
    },
  };
};
