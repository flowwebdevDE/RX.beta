const ua = navigator.userAgent.toLowerCase();
    const isIOS = /iphone|ipad|ipod/.test(ua);
    const isStandalone = window.navigator.standalone === true;
    // const isAndroid

    // Nur iOS + WebApp → eigenes Styling aktivieren
    if (isIOS && isStandalone) {
      document.body.classList.add("ios-webapp");
    }
    if (isIOS) {
        dovument.body.classList.add("only-android")
    }