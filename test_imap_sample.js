const Imap = require('imap');

const imap = new Imap({
    user: 'user',
    password: 'password',
    port: 993,
    host: 'host',
    tls: true
});

function connectAsync() {
    return new Promise(function (resolve, nay) {
        imap.on('ready', resolve);
        imap.connect();
    });
}

function openBoxAsync(name, readOnly) {
    return new Promise(function (resolve, nay) {
        imap.openBox(name, readOnly, function (err, mailbox) {
            if (err) nay(err); else resolve(mailbox);
        });
    });
}

function getMailAsync(request, process) {
    return collect_events(request, "message", "error", "end", process || collectEmailAsync, true);
}

function collect_events(thing, good, bad, end, munch, isFetch = false) { // Collect a sequence of events, munching them as you go if you wish.
    return new Promise(function (yay, nay) {
        const ans = [];
        thing.on(good, function () {
            const args = [].slice.call(arguments);
            ans.push(munch ? munch.apply(null, args) : args);
        });
        if (bad) thing.on(bad, nay);
        thing.on(end, function () {
            Promise.all(ans).then(yay);
            if (isFetch) {
                imap.end();
            }
        });
    });
}

function collectEmailAsync(msg, seq) {
    return new Promise(
        function (resolve, nav) {

            const rel = collect_events(msg, "body", "error", "end", collectBody)
                .then(function (x) {
                    return (x && x.length) ? x : null;
                })
            resolve(rel);
        });

}

function collectBody(stream, info) {
    return new Promise(
        function (resolve, nay) {
            const body = collect_events(stream, "data", "error", "end")
                .then(function (bits) {
                    return bits.map(function (c) {
                        return c.toString('utf8');
                    }).join('');
                })
            ;
            resolve(body);
        }
    );

}

function searchForMessages(startData) {
    return new Promise(function (resolve, nay) {
        imap.seq.search([['SINCE', startData], ['SUBJECT', "SMS"]], function (err, result) {
            if (err) nay(err); else resolve(result);
        });
    });
}

async function f(startData = 'March 17, 2019') {
    let emailBody = await connectAsync().then(function () {
        console.log('connected');
    }).then(
        function () {
            return openBoxAsync('INBOX', true);
        }
    ).then(function () {
        return searchForMessages(startData);
    }).then(
        function (result) {
            return getMailAsync(
                imap.seq.fetch(result, {bodies: ['HEADER.FIELDS (FROM)', 'TEXT']})
                ,

                function (message) {
                    // For each e-mail:
                    return collectEmailAsync(message);
                }
            );
        }
    ).then(function (messages) {
        console.log(JSON.stringify(messages, null, 2));
        return messages[messages.length-1][1];
    })
        .catch(function (error) {
            console.error("Oops:", error.message);
            imap.end();
        })


    console.log(emailBody);
}

function f1(){
    setTimeout(()=>f(),9000);
}

f1();





