module.exports = ({ config }) => {
  return {
    ...config,
    plugins: [
      [
        "expo-build-properties",
        {
          android: {
            usesCleartextTraffic: true
          }
        }
      ]
    ]
  };
};