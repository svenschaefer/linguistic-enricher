"use strict";

/**
 * Build a comparator function for deterministic sorting by keys.
 * @param {string[]} keys Ordered property keys.
 * @returns {(a:any,b:any)=>number} Comparator.
 */
function byKeys(keys) {
  return function compare(a, b) {
    for (let i = 0; i < keys.length; i += 1) {
      const key = keys[i];
      const av = a && Object.prototype.hasOwnProperty.call(a, key) ? a[key] : "";
      const bv = b && Object.prototype.hasOwnProperty.call(b, key) ? b[key] : "";

      if (av < bv) {
        return -1;
      }
      if (av > bv) {
        return 1;
      }
    }

    return 0;
  };
}

/**
 * Return a new array sorted deterministically.
 * @param {any[]} list Input list.
 * @param {(a:any,b:any)=>number} comparator Comparator.
 * @returns {any[]} Sorted copy.
 */
function stableSort(list, comparator) {
  return list
    .map(function mapWithIndex(item, index) {
      return { item: item, index: index };
    })
    .sort(function stableCompare(a, b) {
      const result = comparator(a.item, b.item);
      if (result !== 0) {
        return result;
      }
      return a.index - b.index;
    })
    .map(function unmap(entry) {
      return entry.item;
    });
}

module.exports = {
  byKeys,
  stableSort
};
