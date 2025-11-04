document.addEventListener("DOMContentLoaded", () => {
    const themeToggleBtn = document.getElementById("theme-toggle-btn");
    
    if(themeToggleBtn) {
        function setAppTheme(theme) {
            document.body.setAttribute('data-theme', theme);
            localStorage.setItem('theme', theme);
        }

        function initTheme() {
            const savedTheme = localStorage.getItem('theme');
            
            if (savedTheme) {
                setAppTheme(savedTheme);
            } else {
                const currentHour = new Date().getHours(); 
                if (currentHour >= 20 || currentHour < 6) { 
                    setAppTheme('dark');
                } else {
                    setAppTheme('light');
                }
            }
        }

        themeToggleBtn.onclick = function() {
            const currentTheme = document.body.getAttribute('data-theme');
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            setAppTheme(newTheme);
        }

        initTheme();
    }

    const cards = document.querySelectorAll('.feature-card');
    const supportsHover = window.matchMedia('(hover: hover)').matches;

    if (supportsHover && cards.length > 0) {
        cards.forEach(card => {
            const maxRotate = 10; 

            card.addEventListener('mousemove', (e) => {
                const rect = card.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                
                const width = rect.width;
                const height = rect.height;
                
                const rotateX = (maxRotate * (y - height / 2)) / (height / 2) * -1;
                const rotateY = (maxRotate * (x - width / 2)) / (width / 2);

                const mouseXPercent = (x / width) * 100;
                const mouseYPercent = (y / height) * 100;

                card.style.setProperty('--rotate-x', `${rotateX}deg`);
                card.style.setProperty('--rotate-y', `${rotateY}deg`);
                card.style.setProperty('--mouse-x', `${mouseXPercent}%`);
                card.style.setProperty('--mouse-y', `${mouseYPercent}%`);
            });

            card.addEventListener('mouseleave', () => {
                card.style.setProperty('--rotate-x', '0deg');
                card.style.setProperty('--rotate-y', '0deg');
            });
        });
    }

    const revealElements = document.querySelectorAll('.reveal');
    
    if (revealElements.length > 0) {
        const revealObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('active');
                }
            });
        }, {
            threshold: 0.1
        });

        revealElements.forEach(el => {
            revealObserver.observe(el);
        });
    }
});
