//= require typeahead.js.js
//= require changesets
//= require jquery-mentions-input/jquery.elastic.source
//= require jquery-mentions-input/jquery.mentionsInput

$(function () {
  // Shows confirmation dropdown using Github comparison
  var changesetLoaded = false,
      confirmed = true,
      $container = $(".deploy-details"),
      $placeholderPanes = $container.find(".changeset-placeholder"),
      $form = $("#new_deploy"),
      $submit = $form.find('input[type=submit]'),
      $messages = $("#messages"),
      old_height = $messages.css('max-height'),
      expanded = false,
      following = true;

  // load changeset when switching to it
  $("#deploy-tabs a[data-type=github]").click(function (e) {
      e.preventDefault();
      var tab = $(this);
      tab.tab("show");

      if (!changesetLoaded) {
        var changesetUrl = $("#deploy-tabs").data("changesetUrl");

        changesetLoaded = true;

        $.ajax({
          url: changesetUrl,
          dataType: "html",
          success: function (data) {
            var container = $(".deploy-details");
            var placeholderPanes = container.find(".changeset-placeholder");

            placeholderPanes.remove();
            $('#output').after(data);

            // We need to switch to another tab and then switch back in order for
            // the plugin to detect that the DOM node has been replaced.
            $("#deploy-tabs a:first").tab("show");
            tab.tab("show");
          }
        });
      }
  });

  // navigate to the correct tab if we opened this page with a hash/fragment/anchor
  if(window.location.hash !== "") {
    $('.nav-tabs a[href="' + window.location.hash + '"]').trigger('click');
  }

  // when clicking a tab with a hash href, apply that hash to the location to make url copy-pasting possible
  $('.nav-tabs a[href^="#"]').click(function(){
    window.location.hash = this.hash;
  });

  function toggleConfirmed() {
    confirmed = !confirmed;
    $submit.val(!confirmed && $form.data('confirmation') ? 'Review' : 'Deploy!');
    if (!confirmed) {
      $("#deploy-confirmation").hide();
    }
  }
  toggleConfirmed();

  refStatusTypeahead({changed: function() { if(confirmed) { toggleConfirmed(); } }});

  function showDeployConfirmationTab($this) {
    var $navTabs = $this.find("#deploy-confirmation .nav-tabs"),
        hasActivePane = $this.find(".tab-pane.active").length === 0;

    // We need to switch to another tab and then switch back in order for
    // the plugin to detect that the DOM node has been replaced.
    $navTabs.find("a").tab("show");

    // If there is no active pane defined, show first pane
    if (hasActivePane) {
      $navTabs.find("a:first").tab("show");
    }
  }

  // When user clicks a release label, fill the deploy reference field with that version
  $("#recent-releases .release-label").on('click', function(event){
    event.preventDefault();
    // Get version number from link href
    var version = event.target.href.substring(event.target.href.lastIndexOf('/') + 1);
    $("#deploy_reference").val(version);
  });

  $form.submit(function(event) {
    var $this = $(this);

    if(!confirmed && $this.data('confirmation')) {
      toggleConfirmed();
      $("#deploy-confirmation").show();

      showDeployConfirmationTab($this);

      $container.empty();
      $container.append($placeholderPanes);

      $.ajax({
        method: "POST",
        url: $this.data("confirm-url"),
        data: $this.serialize(),
        success: function(data) {
          $placeholderPanes.detach();
          $container.append(data);

          showDeployConfirmationTab($this);
        }
      });

      event.preventDefault();
    }
  });

  // Reduces overhead with throttle, since it is triggered often by contentchanged when old content streams in
  // (scrollHeight + height would be good enough, but over-scrolling does not harm)
  var scrollToBottom = _.throttle(function() {
    $messages.scrollTop($messages.prop("scrollHeight"));
  }, 250);

  function shrinkOutput() {
    expanded = false;
    $messages.css("max-height", old_height);
  }

  function expandOutput() {
    expanded = true;
    $messages.css("max-height", "none");
  }

  // also toggles the button that will be on the finished page so deploys that stop transition cleanly
  function activateModalButton($current) {
    $("#output-options > button, #output-expand-toggle").removeClass("active");
    $current.addClass("active");
  }

  $("#output-follow").click(function() {
    activateModalButton($(this));

    following = true;

    shrinkOutput();

    scrollToBottom();
  });

  $("#output-no-follow").click(function() {
    activateModalButton($(this));

    following = false;

    shrinkOutput();
  });

  $("#output-expand").click(function() {
    activateModalButton($("#output-expand-toggle, #output-expand"));

    following = false;

    expandOutput();
  });

  // on finished pages we only have the 'Expand' button, so it toggles
  $("#output-expand-toggle").click(function() {
    var $self = $(this);

    if($self.hasClass("active")) {
      shrinkOutput();
      $self.removeClass("active");
    } else {
      expandOutput();
      $self.addClass("active");
    }
  });

  // When a message is added via stream.js
  $messages.bind('contentchanged', function() {
    // show the output and hide buddy check
    var $output = $('#output');
    if ($output.find('.output').hasClass("hidden") ) {
      $output.find('.output').removeClass('hidden');
      $output.find('.deploy-check').hide();
    }

    // scroll when following to see new content
    // setTimeout so we scroll after content was inserted
    // this triggers the .scroll below, so be careful of triggering loops
    if (following) { setTimeout(scrollToBottom, 0); }
  });

  // when user scrolls all the way down, start following
  // when user scrolls up, stop following since it would cause jumping
  // (adds 30 px wiggle room since the math does not quiet add up)
  // ... do nothing when in expanded view
  $messages.scroll(function() {
    if(expanded) { return; }
    var position = $messages.prop("scrollHeight") - $messages.scrollTop() - $messages.height() - 30;
    if(position > 0 && following) {
      $("#output-no-follow").click();
    } else if (position < 0 && !following) {
      $("#output-follow").click();
    }
  });

  (function() {
    var HASH_REGEX = /^#L(\d+)(?:-L(\d+))?$/;
    var $highlightedLines;
    var LINES_SELECTOR = '#messages span';

    function linesFromHash() {
      var result = HASH_REGEX.exec(window.location.hash);
      if (result === null) {
        return [];
      } else {
        return result.slice(1);
      }
    }

    function addHighlight(start, end) {
      if (!start) {
        return;
      }
      start = Number(start) - 1;
      if (end) {
        end = Number(end);
      } else {
        end = start + 1;
      }
      $highlightedLines = $(LINES_SELECTOR).slice(start, end).addClass('highlighted');
    }

    function removeHighlight() {
      if ($highlightedLines) {
        $highlightedLines.removeClass('highlighted');
      }
    }

    function highlightAndScroll() {
      highlight();
      scroll();
    }

    function scroll() {
      if ($highlightedLines && $highlightedLines.get(0)) {
        $highlightedLines.get(0).scrollIntoView(true);
      }
    }

    function highlight() {
      removeHighlight();
      var nextLines = linesFromHash();
      addHighlight.apply(this, nextLines);
    }

    function indexOfLine() {
      // the jQuery map passes an index before the element
      var line = arguments[arguments.length - 1];
      return $(line).index(LINES_SELECTOR) + 1;
    }

    $('#messages').on('click', 'span', function(event) {
      event.preventDefault();
      var clickedNumber = indexOfLine($(event.currentTarget));
      var shift = event.shiftKey;
      if (shift && $highlightedLines.length) {
        var requestedLines = $highlightedLines.map(indexOfLine);
        requestedLines.push(clickedNumber);
        requestedLines = requestedLines.sort(function(a, b) {
          return a - b;
        });
        var end = requestedLines.length - 1;
        window.location.hash = 'L' + requestedLines[0] + '-L' + requestedLines[end];
      } else {
        window.location.hash = 'L' + clickedNumber;
      }
      highlight();
    });

    highlightAndScroll();
  }());

  $('[data-toggle="tooltip"]').tooltip();
});

function toggleOutputToolbar() {
  $('.only-active, .only-finished').toggle();
}

function waitUntilEnabled(path) {
  $.ajax({
    url: path,
    success: function(data, status, xhr) {
      if(xhr.status == 204) {
        window.location.reload();
      }
    }
  });

  setTimeout(function() { waitUntilEnabled(path); }, 5000);
}
