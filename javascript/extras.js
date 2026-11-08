/* Bourbon St. Cafe - small extras (separate from script.js, so nothing else is touched).
   1. Menu bar stays at the top while scrolling
   2. "Back to top" button
   3. "Open now / Closed now" badge next to the opening hours
   4. Category tabs on the home menu */
(() => {
    'use strict';

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* ---------- 1. Menu bar stays at the top ---------- */
    const hero = document.querySelector('.all');
    const header = document.querySelector('.all > header');

    if (hero && header) {
        const updateHeader = () => {
            const shouldStick = window.scrollY > 80;
            if (shouldStick === header.classList.contains('header-fixed')) return;

            if (shouldStick) {
                // keep the page from jumping: reserve the space the header used to take
                hero.style.paddingTop = header.offsetHeight + 'px';
                header.classList.add('header-fixed');
            } else {
                header.classList.remove('header-fixed');
                hero.style.paddingTop = '';
            }
        };

        window.addEventListener('scroll', updateHeader, { passive: true });
        updateHeader();
    }

    /* ---------- 2. Back to top button ---------- */
    const topButton = document.getElementById('to-top');

    if (topButton) {
        window.addEventListener('scroll', () => {
            topButton.classList.toggle('show', window.scrollY > 600);
        }, { passive: true });

        topButton.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
        });
    }

    /* ---------- 3. Open now / Closed now ---------- */
    // EDIT HERE: opening hours in 24-hour time, Rwanda time (Africa/Kigali).
    // Each day is [opens, closes]. Use null for a closed day.
    // These match the hours written in the footer. Change both if the hours change.
    const HOURS = {
        Sun: [8, 21],
        Mon: [7, 20],
        Tue: [7, 20],
        Wed: [7, 20],
        Thu: [7, 20],
        Fri: [7, 20],
        Sat: [8, 21]
    };

    const badge = document.getElementById('open-status');

    if (badge) {
        const parts = new Intl.DateTimeFormat('en-US', {
            timeZone: 'Africa/Kigali',
            weekday: 'short',
            hour: 'numeric',
            minute: 'numeric',
            hourCycle: 'h23'
        }).formatToParts(new Date());

        const get = (type) => parts.find((p) => p.type === type).value;
        const today = HOURS[get('weekday')];
        const time = Number(get('hour')) + Number(get('minute')) / 60;
        const isOpen = Boolean(today) && time >= today[0] && time < today[1];

        badge.textContent = isOpen ? 'Open now' : 'Closed now';
        badge.classList.add(isOpen ? 'is-open' : 'is-closed');
    }

    /* ---------- 4. Menu category tabs (All, Drinks, Food, Bakery) ---------- */
    // The menu cards are made by script.js AFTER it loads the menu from the server,
    // so the tabs cannot be built when this file first runs. script.js sends a "menu:ready"
    // event when the cards exist, and we build the tabs then.
    function buildMenuTabs() {
        const cardsBox = document.querySelector('.menu .cards');
        const moreButton = document.getElementById('more-btn');
        if (!cardsBox) return;

        // if the tabs were built before, remove them so they never show twice
        const old = document.querySelector('.menu-tabs');
        if (old) old.remove();

        const cards = [...cardsBox.querySelectorAll('.container')];
        const categories = ['All', ...new Set(cards.map((card) => card.dataset.category).filter(Boolean))];
        if (categories.length < 3) return; // only one category: tabs are not needed

        const tabs = document.createElement('div');
        tabs.className = 'menu-tabs';
        tabs.setAttribute('role', 'group');
        tabs.setAttribute('aria-label', 'Menu categories');

        const show = (category) => {
            // "View more" still controls the extra cards while the "All" tab is open
            const expanded = moreButton && moreButton.getAttribute('aria-expanded') === 'true';

            cards.forEach((card) => {
                const matches = category === 'All' || card.dataset.category === category;
                const isExtra = card.classList.contains('extra');
                card.hidden = !(matches && (category !== 'All' || !isExtra || expanded));
            });

            // a single category shows all of its cards, so "View more" is not needed
            if (moreButton) moreButton.hidden = category !== 'All';

            tabs.querySelectorAll('button').forEach((button) => {
                const on = button.dataset.category === category;
                button.classList.toggle('is-on', on);
                button.setAttribute('aria-pressed', String(on));
            });
        };

        categories.forEach((category) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'menu-tab';
            button.dataset.category = category;
            button.textContent = category;
            button.addEventListener('click', () => show(category));
            tabs.append(button);
        });

        cardsBox.before(tabs);
        show('All');
    }

    document.addEventListener('menu:ready', buildMenuTabs);
    // in case the cards were already there before this file ran
    if (document.querySelector('.menu .cards .container')) buildMenuTabs();
})();