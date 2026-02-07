
// Globals
var session_id = null;

// Frame elements
let main = $('<div/>', { class: 'main'});
let chat = $('<div/>', { class: 'chat'});
let text = $('<textarea/>', { text:'', class: 'text'});

let wrap = $('<div/>', { class: 'wrap'});
let smod = $('<select/>', { text:'', class: 'smod'});
let send = $('<button/>', { text:'Send', class: 'send'});

let hist = $('<div/>', { html:'&#129958;', class: 'hist'});
let qdel = $('<div/>', { html:'&#10060;', class: 'qdel', title:'Delete current chat from history' });
let qnew = $('<div/>', { html:'&#128956;', class: 'qnew', title:'Open a new chat' });
let info = $('<div/>', { html:'&#9432;', class: 'info'});

let hist_popup = $('<div/>', { class: 'hist_popup'});

// API function
function api(httpmethod, path, data) {
  let xhr = $.ajax({
    url: path,
    type: httpmethod,
    dataType: 'json',
    contentType: 'application/json; charset=utf-8',
    data: JSON.stringify(data)
  });
  return xhr;
}

function chat_send(message) {
    now = Date.now();

    // Process session
    if (session_id == null) {
        session_id = `${now}-${Math.floor(Math.random() * 1_000_000).toString().padStart(8, '0')}`;
        localStorage.setItem(session_id, JSON.stringify({'name':message, 'conversation':{}}));
    }
    console.log(session_id);
    let session = JSON.parse(localStorage.getItem(session_id));
    session.conversation[now] = {"role":"user", "content":message};
    localStorage.setItem(session_id, JSON.stringify(session));

    // Process request
    $.when(
        api('post', 'chat', {model:smod.val(), session:session})
    ).done(function(response) {
        // First process storage
        let session = JSON.parse(localStorage.getItem(session_id));
        session.conversation[Date.now()] = {"role":"assistant", "content":response.message};
        localStorage.setItem(session_id, JSON.stringify(session));

        // Add to main
        content = $('<div/>', { html:marked.parse(response.message), class: 'assistant'});
        setTimeout(function() {
            content.find('code.hljs').each(function() {
                copy_append($(this));
            });
        }, 200);
        main.append($('<div/>', { class: 'assistant-wrap'}).append(content));
        setTimeout(function() { main.animate({ scrollTop: main[0].scrollHeight }, 500); });
        hljs.highlightAll();
    });

    // Append message to screen
    main.append($('<div/>', { class: 'user-wrap'}).append($('<div/>', { text:message, class: 'user'})));
    setTimeout(function() { main.animate({ scrollTop: main[0].scrollHeight }, 500); });
    text.val('');
    hljs.highlightAll();
}

function copy_append(el) {
    let copy = $('<div/>', { html:'&#128203;', class:'hist_copy' });
    copy.on('click', function() {
        let copytext = el.parent().find('code:first').text();
        if (navigator.clipboard) {
            navigator.clipboard.writeText(copytext).then(function() {
                copy_animate(copy);
            }).catch(function(err) {
                alert('Failed to copy text: ' + err);
            });
        } else {
            let tmptext = $('<textarea>').val(copytext).appendTo('body');
            tmptext.select();
            document.execCommand('copy');
            tmptext.remove();
            copy_animate(copy);
        }
    });
    el.parent().prepend(copy);

}

function copy_animate(el) {
    el.html('&#10004;');
    el.addClass('hist_copy_ok');
    setTimeout(function() {
        el.html('&#128203;');
        el.removeClass('hist_copy_ok');
    }, 1600);
}

function history_load(key) {
    session_id = key;

    // Clear main
    main.html('')
    main.append($('<div/>', { class: 'assistant-wrap'}).append($('<div/>', { html:marked.parse('Good day &#128075;, how can I be of service?'), class: 'assistant'})));

    // Load content to main 
    let session = JSON.parse(localStorage.getItem(session_id));
    for (ts in session.conversation) {
        let entry = session.conversation[ts];
        let content = null;
        if (entry.role == "user") {
            content = $('<div/>', { html: entry.content, class: entry.role});
        }
        else {
            content = $('<div/>', { html:marked.parse(entry.content), class: entry.role});
            setTimeout(function() {
                content.find('code.hljs').each(function() {
                    copy_append($(this));
                });
            }, 200);
        }
        main.append($('<div/>', { class: `${entry.role}-wrap`}).append(content));
    }
    setTimeout(function() { main.scrollTop(main[0].scrollHeight); });
    hljs.highlightAll();
}

// Document onload function
$(document).ready( function () {

    // Setup marked with highlight.js
    marked.setOptions({
        highlight: function (code, lang) {
            // Check if language is supported by hljs
            if (lang && hljs.getLanguage(lang)) {
                return hljs.highlight(code, { language: lang }).value;
            }
            // Auto-detect language if not specified
            return hljs.highlightAuto(code).value;
        }
    });

    // Get models
    $.when(
        api('get', 'list')
    ).done(function(response) {
        response.models.forEach(model => {
            smod.append($('<option/>', {
                value: model,
                text: model
            }));
        });
        // Set active model
        conf_model = localStorage.getItem('_conf_model');
        if (smod.find('option[value="' + conf_model + '"]').length > 0) {
            smod.val(conf_model);
        }
    });

    // Interface element events
    text.on('keydown', function(event) {
        // Enter
        if (event.key === 'Enter' && !event.shiftKey) {            
            event.preventDefault();
            chat_send(text.val());
        }
        // Shift + Enter
        if (event.key === 'Enter' && event.shiftKey) {
            event.preventDefault();
            var tmp = $(this).val();
            var cpos = this.selectionStart;
            $(this).val(tmp.substring(0, cpos) + '\n' + tmp.substring(cpos));
            this.selectionStart = this.selectionEnd = cpos + 1;
        }
    });
    send.on('click', function() {
        chat_send(text.val());
    });
    smod.on('change', function() {
        localStorage.setItem('_conf_model', smod.val());
    });
    hist.on('click', function(e) {
        if (!hist_popup.is(':visible')) {
            e.stopPropagation();
            hist_popup.empty().show();
            let midnight = new Date();
            midnight.setHours(0, 0, 0, 0);
            for (let i = localStorage.length - 1; i >= 0; i--) {
                let key = localStorage.key(i);
                let value = localStorage.getItem(key);        
                if (/^\d/.test(key)) {
                    let ts = new Date(parseInt(key.split('-')[0]));
                    let fmtdate = 'Today';
                    if (ts < midnight) {
                        fmtdate = [];
                        fmtdate.push(String(ts.getDate()).padStart(2, '0'));
                        fmtdate.push(String(ts.getMonth()+1).padStart(2, '0'));
                        fmtdate.push(ts.getFullYear());
                        fmtdate = fmtdate.join('-');
                    }
                    let fmttime = [];
                    fmttime.push(String(ts.getHours()).padStart(2, '0'));
                    fmttime.push(String(ts.getMinutes()).padStart(2, '0'));
                    fmttime = fmttime.join(':');

                    entry = $('<div/>', { class: 'hist_popup_entry'});
                    entry.append( $('<div/>', { html:`${fmtdate} ${fmttime}`, class: 'hist_popup_date'}), JSON.parse(value).name );
                    entry.on('click', function() {
                        history_load(key);
                    });
                    hist_popup.append(entry);
                }
            }
        }
    });
    qnew.on('click', function() {
        session_id = null;
        main.html('')
        main.append($('<div/>', { class: 'assistant-wrap'}).append($('<div/>', { html:marked.parse('Good day &#128075;, how can I be of service?'), class: 'assistant'})));
    });
    qdel.on('click', function() {
        if (confirm('Are you sure you want to remove this chat?')) {
            localStorage.removeItem(session_id);
            session_id = null;
            main.html('')
            main.append($('<div/>', { class: 'assistant-wrap'}).append($('<div/>', { html:marked.parse('Good day &#128075;, how can I be of service?'), class: 'assistant'})));
        }
    });
    info.on('click', function() {
        window.open('https://github.com/JCQ81/ollama-web', '_blank');
    });

    // Create view
    wrap.append(smod, '<br>', send);    
    chat.append(text, wrap);
    $('body').append(main, chat, hist, hist_popup, qdel, qnew, info);

    main.append($('<div/>', { class: 'assistant-wrap'}).append($('<div/>', { html:marked.parse('Good day &#128075;, how can I be of service?'), class: 'assistant'})));

});

$(document).on('click', function () {
    hist_popup.empty().hide();
});
