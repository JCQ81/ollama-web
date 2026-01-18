
// Globals
var session_id = null;

// Frame elements
let main = $('<div/>', { class: 'main'});
let chat = $('<div/>', { class: 'chat'});
let text = $('<textarea/>', { text:'', class: 'text'});

let wrap = $('<div/>', { class: 'wrap'});
let smod = $('<select/>', { text:'', class: 'smod'});
let send = $('<button/>', { text:'Send', class: 'send'});

let hist = $('<select/>', { text:'', class: 'hist'});
let info = $('<div/>', { html:'&#9432;', class: 'info'});

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
        main.append($('<div/>', { class: 'assistant-wrap'}).append($('<div/>', { html:marked(response.message), class: 'assistant'})));

        let session = JSON.parse(localStorage.getItem(session_id));
        session.conversation[Date.now()] = {"role":"assistant", "content":response.message};
        localStorage.setItem(session_id, JSON.stringify(session));
    });

    // Append message to screen
    main.append($('<div/>', { class: 'user-wrap'}).append($('<div/>', { text:message, class: 'user'})));
    text.val('');
}


// Document onload function
$(document).ready( function () {
    // Setup marked and highlightjs
    marked.setOptions({
        highlight: function(code, lang) {
        return hljs.highlight(code, {language:lang}).value;
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

    // Load history
    hist.append($('<option/>', {value: '0', text: '- cancel -'}));
    for (let i = localStorage.length - 1; i >= 0; i--) {
        let key = localStorage.key(i);
        let value = localStorage.getItem(key);        
        if (/^\d/.test(key)) {
            hist.append($('<option/>', {
                value: key,
                text: JSON.parse(value).name
            }));
        }
    }

    // Interface element events
    text.on('keydown', function(event) {
        // Enter
        if (event.key === 'Enter' && !event.ctrlKey) {            
            event.preventDefault();
            chat_send(text.val());
        }
        // Ctrl + Enter
        if (event.key === 'Enter' && event.ctrlKey) {
            event.preventDefault();
            let tmp = text.val();
            text.val(tmp + '\n');
        }
    });
    send.on('click', function() {
        chat_send(text.val());
    });
    smod.on('change', function() {
        localStorage.setItem('_conf_model', smod.val());
    });
    info.on('click', function() {
        window.open('https://github.com/JCQ81/ollama-web', '_blank');
    });
    
    hist.on('change', function() {
        if (hist.val() != '0') {
            session_id = hist.val();
            hist.val('0');

            // Clear main
            main.html('')
            main.append($('<div/>', { class: 'assistant-wrap'}).append($('<div/>', { html:marked('Good day &#128075;, how can I be of service?'), class: 'assistant'})));

            // Load content to main 
            let session = JSON.parse(localStorage.getItem(session_id));
            for (ts in session.conversation) {
                let entry = session.conversation[ts];
                let content = entry.role == 'assistant' ? marked(entry.content) : entry.content;
                main.append($('<div/>', { class: `${entry.role}-wrap`}).append($('<div/>', { html:content, class: entry.role})));
            }
        }
    })

    // Create view
    wrap.append(smod, '<br>', send);    
    chat.append(text, wrap);
    $('body').append(main, chat, hist, info);

    main.append($('<div/>', { class: 'assistant-wrap'}).append($('<div/>', { html:marked('Good day &#128075;, how can I be of service?'), class: 'assistant'})));

});
