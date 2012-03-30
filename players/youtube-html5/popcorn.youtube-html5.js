  var DEFAULT_WIDTH = "560",
      DEFAULT_HEIGHT = "315";

  var __youTubeReadyListeners = [],
      __oldYouTubeReadyListener
      __urlRegex = /^.*(?:\/|v=)(.{11})/;

  // Fire the things that were waiting
  function fireYouTubeReadyListeners() {
    var listeners = __youTubeReadyListeners;
    for ( var i=0; i<listeners.length; ++i ) {
      listeners[ i ]();
    } //for
    if ( __oldYouTubeReadyListener ) {
      __oldYouTubeReadyListener();
    } //if
  } //fireYouTubeReadyListeners

  // Don't stomp on something that was already listening
  if ( window.onYouTubePlayerAPIReady ) {
    __oldYouTubeReadyListener = window.onYouTubePlayerAPIReady;
  } //if
  window.onYouTubePlayerAPIReady = fireYouTubeReadyListeners;

  if ( !window.YT ) {
    var script = document.createElement( "script" );
    script.src = "http://www.youtube.com/player_api";
    if ( document.head ) {
      document.head.appendChild( script );
    }
    else if ( document.body ) {
      document.body.appendChild( script );
    }
    else {
      document.write( '<script src="' + script.src + '"></script>' );
    } //if
  } //if

  Popcorn.player( "youtubehtml5", {
	_canPlayType: function( nodeName, url ) {	
	  return (/(?:http:\/\/www\.|http:\/\/|www\.|\.|^)(youtu)/).test( url ) && nodeName.toLowerCase() !== "video";
	},
    _setup: function( options ) {

      var media = this,
          container = document.createElement( "div" ),
          src = __urlRegex.exec( media.src )[ 1 ],
          query = ( media.src.split( "?" )[ 1 ] || "" ).replace( /v=.{11}/, "" ),
          autoPlay = ( /autoplay=1/.test( query ) );
          width = media.style.width ? "" + media.offsetWidth : DEFAULT_WIDTH,
          height = media.style.height ? "" + media.offsetHeight : DEFAULT_HEIGHT
          currentTime = 0,
          
          _startCurrentTime = options.start || 0,
          _startMuted = false,
          _startVolume = 0,
          
          _volume = 0,
          _volumeCheckInterval = -1,
          
          seekTime = 0,
          firstGo = true,
          seeking = false,
          
          // state code for volume changed polling
          volumeChanged = false,
          lastMuted = false,
          lastVolume = 100,
          
          playerVars = {
            autohide: (options.autohide == undefined ? 2 : options.autohide),
            autoplay: (options.autoplay == undefined ? 0 : options.autoplay),
            controls: (options.controls == undefined ? 1 : options.controls),
            modestbranding: (options.modestbranding == undefined ? 0 : options.modestbranding),
            loop: (options.loop == undefined ? 0 : options.loop),
            playlist: (options.playlist == undefined ? '' : options.playlist),
            start: (options.start == undefined ? 0 : options.start),
            theme: (options.theme == undefined ? 'dark' : options.theme)
          };

      media.readyState = 0; //NOTHING
      media.networkState = 0; //EMPTY
      
      // setting paused to undefined because youtube has state for not paused or playing
      media.paused = true;
      container.id = media.id + Popcorn.guid();
      
      options._container = container;
      
      media.appendChild( container );

      function update() {
        var val = options.youtubeObject.getVolume() / 100;
        if ( _volume !== val ) {
          _volume = val;
          media.dispatchEvent( "volumechange" );
        } //if
        currentTime = options.youtubeObject.getCurrentTime();
        if ( seeking && seeking === currentTime ) {
          seeking = false;
          media.dispatchEvent( "seeked" );
        } //if
        media.dispatchEvent( "timeupdate" );
        if ( media.networkState !== 1 && options.youtubeObject.getVideoBytesLoaded() === options.youtubeObject.getVideoBytesTotal() ) {
          media.networkState = 1; //IDLE
        } //if
      } //update

      function onPlayerReady( e ) {
      	if(autoPlay)
      	  media.paused = false;
      	media.readyState = 4;
        media.dispatchEvent( "canplay" );
        media.dispatchEvent( "canplaythrough" );
        media.dispatchEvent( "loadeddata" );
        Object.defineProperties( media, {
          currentTime: {
            set: function( val ) {
              // make sure val is a number
	          currentTime = seekTime = +val;
	          seeking = true;
	
	          if ( options.destroyed ) {
	            return currentTime;
	          }
	          media.dispatchEvent( "seeked" );
	          media.dispatchEvent( "timeupdate" );
	          options.youtubeObject.seekTo( currentTime );
	          return currentTime;
            },
            get: function() {
              return currentTime;
            }
          },
          muted: {
            set: function( val ) {
              if ( options.destroyed ) {
                return val;
              }	
              if ( options.youtubeObject.isMuted() !== val ) {
                if ( val ) {
                  options.youtubeObject.mute();
                }
                else {
                  options.youtubeObject.unMute();
                } //if
                lastMuted = options.youtubeObject.isMuted();
                media.dispatchEvent( "volumechange" );
              } //if
            },
            get: function() {
              if ( options.destroyed ) {

                return 0;
              }
              return options.youtubeObject.isMuted();
            }
          },
          volume: {
            set: function( val ) {
              if ( options.destroyed ) {
                return val;
              }
              _volume = val;
              options.youtubeObject.setVolume( val * 100 );
              media.dispatchEvent( "volumechange" );
            },
            get: function() {
              if ( options.destroyed ) {
                return 0;
              }
              return _volume;
            }
          }
        });

        media.duration = options.youtubeObject.getDuration();
        media.dispatchEvent( "durationchange" );

        // set the mute and volume, but not currentTime since it should happen automagically
        media.muted = _startMuted;
        media.volume = _startVolume;

        _volumeCheckInterval = setInterval( update, 10 );

        media.readyState = 1; //METADATA
        media.networkState = 2; //EMPTY

      } //onPlayerReady

      function onPlayerStateChange( e ) {
      	 var state = e.data;
         if ( options.destroyed ) {
            return;
          }

          // youtube fires paused events while seeking
          // this is the only way to get seeking events
          if ( state === YT.PlayerState.PAUSED ) {

            // silly logic forced on me by the youtube API
            // calling youtube.seekTo triggers multiple events
            // with the second events getCurrentTime being the old time
            if ( seeking && seekTime === currentTime && seekTime !== options.youtubeObject.getCurrentTime() ) {

              seeking = false;
              options.youtubeObject.seekTo( currentTime );
              return;
            }

            currentTime = options.youtubeObject.getCurrentTime();
            media.dispatchEvent( "timeupdate" );
            !media.paused && media.pause();

            return;
          } else
          if ( state === YT.PlayerState.PLAYING && !firstGo ) {

            media.paused && media.play();
            return;
          } else
          // this is the real player ready check
          // -1 is for unstarted, but ready to go videos
          // before this the player object exists, but calls to it may go unheard
          if ( state === -1 ) {
			media.dispatchEvent( "load" );
            //options.youtubeObject.playVideo();
            //return;
          } else
          if ( state === YT.PlayerState.PLAYING && firstGo ) {

            firstGo = false;

            if ( media.paused === true ) {

              media.pause();
            } else if ( media.paused === false ) {

              media.play();
            } else if ( autoPlay ) {
              media.play();	
            } else if ( !autoPlay ) {

              media.pause();
            }

            media.duration = options.youtubeObject.getDuration();

            media.dispatchEvent( "durationchange" );
            update();

            media.dispatchEvent( "loadedmetadata" );
            media.dispatchEvent( "loadeddata" );

            media.readyState = 4;
            media.dispatchEvent( "canplaythrough" );

            return;
          } else if ( state === YT.PlayerState.ENDED ) {
            media.dispatchEvent( "ended" );
          }
      } //onPlayerStateChange

      function onPlaybackQualityChange( e ) {
      } //onPlaybackQualityChange

      function onError( e ) {
      	 var errorCode = e.data;
      	 if ( [ 2, 100, 101, 150 ].indexOf( errorCode ) !== -1 ) {
            media.dispatchEvent( "error" );
          }
      } //onError

      function onYouTubeReady() {
        options.youtubeObject = new YT.Player( container, {
          height: height,
          width: width,
          videoId: src,
          playerVars: playerVars,
          events: {
            'onReady': onPlayerReady,
            'onStateChange': onPlayerStateChange,
            'onPlaybackQualityChange': onPlaybackQualityChange,
            'onError': onError
          }
        });
      } //onYouTubeReady

      media.play = function( time ) {
      	 if ( options.destroyed ) {
            return;
          }

          if ( media.paused !== false || options.youtubeObject.getPlayerState() !== 1 ) {
            media.paused = false;
            media.dispatchEvent( "play" );

            media.dispatchEvent( "playing" );
          }

          update();
          options.youtubeObject.playVideo();
      };

      media.pause = function( time ) {
          if ( options.destroyed ) {
            return;          
          }

          if ( media.paused !== true || options.youtubeObject.getPlayerState() !== 2 ) {
            media.paused = true;
            media.dispatchEvent( "pause" );
            options.youtubeObject.pauseVideo();
          }
      };

      // Dummy functionality setup before player actually loads
      Object.defineProperties( media, {
        currentTime: {
          get: function() {
            return _startCurrentTime;
          },
          set: function( val ) {
            _startCurrentTime = val;
          }
        },
        muted: {
          get: function() {
            return _startMuted;
          },
          set: function( val ) {
            _startMuted = val;
          }
        },
        volume: {
          get: function() {
            return _startVolume;
          },
          set: function( val ) {
            _startVolume = val;
          }
        }
      });

      if ( !window.YT ) {
        __youTubeReadyListeners.push( onYouTubeReady );
      }
      else {
        onYouTubeReady();
      } //if

    }, //_setup
    _teardown: function( options ) {
	    options.destroyed = true;
	    options.youtubeObject.stopVideo();
	    options.youtubeObject.clearVideo();
	    this.removeChild( document.getElementById( options._container.id ) );
    }
  });
