/**
 * A module with helper functions
 * @module utils
 */

/**
 * Object Rename Key.
 * @function objectRenameKey
 */
const objectRenameKey = (obj, oldKey, newKey) => {
  Object.defineProperty(
    obj,
    newKey,
    Object.getOwnPropertyDescriptor(obj, oldKey)
  );
  // eslint-disable-next-line no-param-reassign
  delete obj[oldKey];
  return obj;
};

/**
 * Kills the program process.
 * @function killApplication
 */
const killApplication = () => process.kill(process.pid);

module.exports = { objectRenameKey, killApplication };
