const u = up.util
const e = up.element

up.FieldObserver = class FieldObserver {

  constructor(form, fields, options, callback) {
    this.scheduleValues = this.scheduleValues.bind(this)
    this.isNewValues = this.isNewValues.bind(this)
    this.callback = callback
    this.form = form
    this.fields = fields
    this.options = options
    this.defaults = options.defaults
    this.batch = options.batch
    this.intent = options.intent || 'observe'
    // this.attrPrefix = options.attrPrefix || 'up-observe'
    this.formOptions = up.form.submitOptions(form)
    this.formOptionsForIntent = {
      feedback: e.booleanAttr(this.form, `up-${this.intent}-feedback`),
      disable: e.booleanOrStringAttr(this.form, `up-${this.intent}-disable`),
      delay: e.numberAttr(this.form, `up-${this.intent}-delay`),
      event: e.stringAttr(this.form, `up-${this.intent}-event`)
    }

    this.subscriber = new up.Subscriber()
  }

  fieldOptions(field) {
    let options = { ...this.options, origin: field }
    let parser = new up.OptionsParser(options, field, { closest: true, ignore: this.form })

    // We get the { feedback } option through the following priorities:
    // (0) Passed as explicit observe() option (this.options.feedback)
    // (1) Attribute prefixed to the observe() type (Closest [up-observe-feedback] attr)
    // (2) Default config for this observe() type (options.defaults.feedback)
    // (3) Option for regular submit (this.submitOptions.feedback)
    parser.boolean('feedback', { default: this.formOptionsForIntent.feedback ?? this.defaults.feedback ?? this.formOptions.feedback })
    parser.booleanOrString('disable', { default: this.formOptionsForIntent.disable ?? this.defaults.disable ?? this.formOptions.disable })
    parser.number('delay', { attr: this.attrPrefix + '-delay', default: this.formOptionsForIntent.delay ?? this.defaults.delay})
    parser.string('event', { attr: this.attrPrefix + '-event', default: this.formOptionsForIntent.event ?? u.evalOption(this.defaults.event, field) })

    throw "weird: ich kann <input up-autosubmit up-delay=300> machen, aber nicht <form up-autosubmit up-event='foo'>"

    return options
  }

  // fieldOptions(field) {
  //   let options = { ...this.options, origin: field }
  //   let parser = new up.OptionsParser(options, field, { closest: true })
  //
  //   // We get the { feedback } option through the following priorities:
  //   // (0) Passed as explicit observe() option (this.options.feedback)
  //   // (1) Attribute prefixed to the observe() type (Closest [up-observe-feedback] attr)
  //   // (2) Default config for this observe() type (options.defaults.feedback)
  //   // (3) Option for regular submit (this.submitOptions.feedback)
  //   parser.boolean('feedback', { attr: this.attrPrefix + '-feedback', default: this.defaults.feedback ?? this.submitOptions.feedback })
  //   parser.boolean('disable', { attr: this.attrPrefix + '-disable', default: this.defaults.disable ?? this.submitOptions.disable })
  //   parser.number('delay', { attr: this.attrPrefix + '-delay', default: this.defaults.delay })
  //   parser.string('event', { attr: this.attrPrefix + '-event', default: u.evalOption(this.defaults.event, field) })
  //
  //   return options
  // }

  start() {
    this.scheduledValues = null
    this.processedValues = this.readFieldValues()
    this.currentTimer = undefined
    this.callbackRunning = false

    for (let field in this.fields) {
      let fieldOptions = this.fieldOptions(field)
      this.subscriber.on(field, fieldOptions.event, (event) => this.check(event, fieldOptions))
    }

    if (this.form) {
      this.subscriber.on(this.form, 'up:form:submit', () => this.cancelTimer())
    }
  }

  stop() {
    this.subscriber.unbindAll()
    this.cancelTimer()
  }

  cancelTimer() {
    clearTimeout(this.currentTimer)
    this.currentTimer = undefined
  }

  isAnyFieldAttached() {
    return u.some(this.fields, (field) => !e.isDetached(field))
  }

  scheduleValues(values, fieldOptions) {
    this.cancelTimer()
    this.scheduledValues = values
    let delay = u.evalOption(fieldOptions.delay, event)
    this.currentTimer = u.timer(delay, () => {
      this.currentTimer = undefined
      if (this.isAnyFieldAttached()) {
        this.requestCallback(fieldOptions)
      }
    })
  }

  isNewValues(values) {
    return !u.isEqual(values, this.processedValues) && !u.isEqual(this.scheduledValues, values)
  }

  async requestCallback(fieldOptions) {
    if ((this.scheduledValues !== null) && !this.currentTimer && !this.callbackRunning) {
      const diff = this.changedValues(this.processedValues, this.scheduledValues)
      this.processedValues = this.scheduledValues
      this.scheduledValues = null
      this.callbackRunning = true

      const callbackReturnValues = []
      if (this.batch) {
        callbackReturnValues.push(this.callback(diff, fieldOptions))
      } else {
        for (let name in diff) {
          const value = diff[name]
          callbackReturnValues.push(this.callback(value, name, fieldOptions))
        }
      }

      await u.allSettled(callbackReturnValues)
      this.callbackRunning = false
      this.requestCallback()
    }
  }

  changedValues(previous, next) {
    const changes = {}
    let keys = Object.keys(previous)
    keys = keys.concat(Object.keys(next))
    keys = u.uniq(keys)
    for (let key of keys) {
      const previousValue = previous[key]
      const nextValue = next[key]
      if (!u.isEqual(previousValue, nextValue)) {
        changes[key] = nextValue
      }
    }
    return changes
  }

  readFieldValues() {
    return up.Params.fromFields(this.fields).toObject()
  }

  check(event, fieldOptions) {
    const values = this.readFieldValues()
    if (this.isNewValues(values)) {
      this.scheduleValues(values, fieldOptions)
    }
  }
}
