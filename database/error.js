class RecordDoesNotExist extends Error {
  constructor(message) {
    super(message);
    this.name = "RecordDoesNotExist";
  }
}

class NonUniqueRecordError extends Error {
  constructor(message) {
    super(message);
    this.name = "NonUniqueRecordError";
  }
}

module.exports = {
  RecordDoesNotExist,
  NonUniqueRecordError,
};
