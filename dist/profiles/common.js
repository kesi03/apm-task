"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pickStrings = pickStrings;
exports.pickValues = pickValues;
function pickStrings(values) {
    const out = {};
    for (const [key, value] of Object.entries(values)) {
        if (value) {
            out[key] = value;
        }
    }
    return out;
}
function pickValues(values) {
    const out = {};
    for (const [key, value] of Object.entries(values)) {
        if (value !== undefined && value !== null && value !== '') {
            out[key] = value;
        }
    }
    return out;
}
//# sourceMappingURL=common.js.map