#= require ./base

u = up.util
e = up.element

class up.Layer.Root extends up.Layer

  @mode: 'root'

  constructor: (options) ->
    super(options)
    @history = true

    # When we reset the framework during tests, we might re-initialize this
    # layer with the same <html> element. In this case we do not want to
    # setup handlers more than once.
    unless @element.upHandlersApplied
      @element.upHandlersApplied = true
      @setupHandlers()

  # Always return the current <body> instead of caching it,
  # since the developer might replace it with a new version.
  @getter 'element', ->
    # Let's talk about our choice of @element for the root layer.
    #
    # 1. We don't want to use `document`, since that is for our global event bus.
    #    For instance, take a look how up.Change.CloseLayer emits the up:layer:closed
    #    event first on `@layer.element`, then on `document`.
    #    Also `document` is not really an element, just an event target.
    # 2. We want but cannot use <body> element. Since Unpoly boots before
    #    the DOM is ready, document.body is still undefined. We also cannot delay
    #    booting until the DOM is ready, since by then all user-defined event listeners
    #    and compilers will have registered.
    # 3. That leaves the <html> element, which is available before the DOM is ready
    #    on Chrome, Firefox, IE11, Safari.
    return e.root

  @getter 'contentElement', ->
    # This is used in Layer#affix()
    document.body

  @selector: ->
    'html'

  allElements: (selector) ->
    matches = e.all(selector)
    # Since our @element also contains all the other layers we need
    # to filter matches to exclude elements that belong to another layer.
    matches = u.filter(matches, @contains)
    return matches

  repair: ->
    # In case a fragment update has swapped the <html> element we need to re-apply
    # event handlers to the new <html> element.
    @setupHandlers()
