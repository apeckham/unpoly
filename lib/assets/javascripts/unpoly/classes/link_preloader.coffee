u = up.util
e = up.element

class up.LinkPreloader

  constructor: ->

  observeLink: (link) ->
    # If the link has an unsafe method (like POST) and is hence not preloadable,
    # prevent up.link.preload() from blowing up by not observing the link (even if
    # the user uses [up-preload] everywhere).
    if up.link.isSafe(link)
      @on link, 'mouseenter',           (event) => @considerPreload(event, true)
      @on link, 'mousedown touchstart', (event) => @considerPreload(event)
      @on link, 'mouseleave',           (event) => @stopPreload(event)

  on: (link, eventTypes, callback) ->
    up.on(link, eventTypes, { passive: true }, callback)

  considerPreload: (event, applyDelay) =>
    link = event.target
    if link != @currentLink
      @reset()

      @currentLink = link

      # Don't preload when the user is holding down CTRL or SHIFT.
      if up.link.shouldFollowEvent(event, link)
        if applyDelay
          @preloadAfterDelay(link)
        else
          @preloadNow(link)

  stopPreload: (event) ->
    if event.target == @currentLink
      @reset()

  reset: ->
    return unless @currentLink

    clearTimeout(@timer)

    if @queued
      followOptions = up.link.followOptions(@currentLink)
      up.network.abort (request) ->
        # Only abort when we're still preloading, not when navigation
        # has started.
        request.preload &&
          request.method == followOptions.method &&
          request.url == followOptions.url

    @queued = false
    @currentLink = undefined

  preloadAfterDelay: (link) ->
    delay = e.numberAttr(link, 'up-delay') ? up.link.config.preloadDelay
    @timer = u.timer(delay, => @preloadNow(link))

  preloadNow: (link) ->
    up.log.muteRejection up.link.preload(link)
    @queued = true