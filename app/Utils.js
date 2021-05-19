/**
 * A module with helper functions
 * @module utils
 */

/**
 * Object Rename Key.
 * @function objectRenameKey
 */
const objectRenameKey = (obj, old_key, new_key) => {
  Object.defineProperty(
    obj,
    new_key,
    Object.getOwnPropertyDescriptor(obj, old_key)
  );
  delete obj[old_key];
  return obj;
};

/**
 * Kills the program process.
 * @function killApplication
 */
const killApplication = () => process.kill(process.pid);

module.exports = { objectRenameKey, killApplication };
