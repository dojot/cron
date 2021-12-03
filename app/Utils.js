/**
 * A module with helper functions
 * @module utils
 */

/**
 * Object Rename Key.
 * @function objectRenameKey
 */
const objectRenameKey = (obj, oldKey, newKey) => {
  const newObj = { ...obj };
  Object.defineProperty(
    newObj,
    newKey,
    Object.getOwnPropertyDescriptor(newObj, oldKey)
  );
  // eslint-disable-next-line security/detect-object-injection
  delete newObj[oldKey];
  return newObj;
};

/**
 * Kills the program process.
 * @function killApplication
 */
const killApplication = () => process.kill(process.pid, 'SIGTERM');

module.exports = { objectRenameKey, killApplication };
