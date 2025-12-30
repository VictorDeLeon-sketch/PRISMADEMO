const App = {
    searchIndex: [],
    lastRenderedState: { topicId: null, mode: null },

    init() {
        // Build Search Index
        this.generateSearchIndex();

        // Router Logic
        window.addEventListener('hashchange', this.handleRoute.bind(this));

        // Initial Route
        this.handleRoute();

        // Search Listeners
        this.setupSearchListeners();

        // Subscribe to State Changes
        AppState.subscribe(() => {
            // Always update navbar (e.g. for avatar changes)
            this.updateNavbar();

            // Re-render current view if necessary
            const hash = window.location.hash;

            if (hash.startsWith('#topic/')) {
                const [_, subject, topicId] = hash.split('/');

                // Check if re-render is needed (prevents loop when progress saves)
                if (topicId === this.lastRenderedState.topicId && AppState.currentMode === this.lastRenderedState.mode) {
                    return;
                }

                const topicData = this.getTopicData(subject, topicId);
                if (topicData) {
                    Renderers.renderUniversalCard('app', topicData);
                    this.lastRenderedState = { topicId, mode: AppState.currentMode };
                }
            } else if (hash === '#profile') {
                Renderers.renderProfile('app');
            }
        });
    },

    setupSearchListeners() {
        const searchInput = document.querySelector('#search-container input');
        const searchBtn = document.querySelector('#search-container button');
        const suggestionsContainer = document.getElementById('search-suggestions');

        if (searchInput) {
            // Remove old listeners (naive approach: clone)
            const newInput = searchInput.cloneNode(true);
            searchInput.parentNode.replaceChild(newInput, searchInput);

            // Input event for Autocomplete
            newInput.addEventListener('input', (e) => {
                this.handleSearchInput(e.target.value);
            });

            // Enter key for full search
            newInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.handleSearch(newInput.value);
                    if (suggestionsContainer) suggestionsContainer.classList.add('hidden');
                }
            });

            // Blur event to hide suggestions (delayed to allow click)
            newInput.addEventListener('blur', () => {
                setTimeout(() => {
                    if (suggestionsContainer) suggestionsContainer.classList.add('hidden');
                }, 200);
            });
        }

        // Note: The button might not exist in the new design (it's just an icon), but if we want it clickable:
        // In index.html, the icon is in a div, not a button, so we might need to select the wrapper or icon.
        // For now, Enter key is primary.
    },

    generateSearchIndex() {
        this.searchIndex = [];

        // 1. Add Static Courses
        this.searchIndex.push(
            { type: 'course', id: 'comipems', title: 'Ingreso a Media Superior (COMIPEMS)', subtitle: 'Curso Completo • 128 Temas', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253', color: 'text-neon-blue' },
            { type: 'course', id: 'derecho', title: 'Introducción al Estudio del Derecho', subtitle: 'Curso Universitario', icon: 'M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3', color: 'text-neon-pink' }
        );

        // 2. Index Topics from CURRICULUM_DATA
        if (typeof CURRICULUM_DATA !== 'undefined') {
            Object.keys(CURRICULUM_DATA).forEach(subjectKey => {
                const subject = CURRICULUM_DATA[subjectKey];

                // Helper to add topic
                const addTopic = (topic) => {
                    this.searchIndex.push({
                        type: 'topic',
                        id: topic.id,
                        subject: subjectKey,
                        title: topic.title,
                        subtitle: `Tema • ${subject.title}`,
                        icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
                        color: `text-${subject.color || 'white'}`
                    });
                };

                // 1. Legacy Flat Topics
                if (subject.topics) {
                    subject.topics.forEach(addTopic);
                }

                // 2. Modular Topics
                if (subject.modules) {
                    subject.modules.forEach(mod => {
                        if (mod.topics) {
                            mod.topics.forEach(addTopic);
                        }
                    });
                }
            });
        }
    },

    handleSearchInput(query) {
        const suggestionsContainer = document.getElementById('search-suggestions');
        if (!suggestionsContainer) return;

        if (!query || query.length < 2) {
            suggestionsContainer.classList.add('hidden');
            return;
        }

        const q = query.toLowerCase();
        const matches = this.searchIndex.filter(item =>
            item.title.toLowerCase().includes(q) || item.subtitle.toLowerCase().includes(q)
        ).slice(0, 6); // Limit to 6 suggestions

        if (matches.length > 0) {
            suggestionsContainer.innerHTML = matches.map(item => this.renderSuggestionItem(item)).join('');
            suggestionsContainer.classList.remove('hidden');
        } else {
            suggestionsContainer.classList.add('hidden');
        }
    },

    renderSuggestionItem(item) {
        // We defined onclick to use App.navigateToSuggestion
        // Properly quote string arguments
        const args = item.type === 'course' ? `'course', '${item.id}'` : `'topic', '${item.id}', '${item.subject}'`;

        return `
            <div onclick="App.navigateToSuggestion(${args})" 
                 class="flex items-center gap-4 px-4 py-3 hover:bg-white/5 cursor-pointer transition-colors border-b border-white/5 last:border-0 pointer-events-auto">
                <div class="w-8 h-8 rounded-lg bg-gray-800 flex items-center justify-center ${item.color} flex-shrink-0">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="${item.icon}"></path>
                    </svg>
                </div>
                <div class="min-w-0">
                    <h4 class="text-sm font-bold text-gray-200 truncate">${item.title}</h4>
                    <p class="text-xs text-gray-500 truncate">${item.subtitle}</p>
                </div>
                <div class="ml-auto">
                    <svg class="w-4 h-4 text-gray-600 -rotate-45" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
                </div>
            </div>
        `;
    },

    navigateToSuggestion(type, id, subject) {
        if (type === 'course') {
            window.location.hash = `#course/${id}`;
        } else if (type === 'topic') {
            window.location.hash = `#topic/${subject}/${id}`;
        }

        // Hide suggestions and clear input
        const suggestionsContainer = document.getElementById('search-suggestions');
        const input = document.querySelector('#search-container input');
        if (suggestionsContainer) suggestionsContainer.classList.add('hidden');
        if (input) input.value = '';
    },

    handleSearch(query) {
        if (!query || !query.trim()) return;
        window.location.hash = `#search/${encodeURIComponent(query.trim())}`;
    },

    handleLogoClick() {
        if (AppState.isLoggedIn) {
            window.location.hash = '#courses';
        } else {
            window.location.hash = '#home';
        }
    },

    handleRoute() {
        const hash = window.location.hash || '#home';
        const appContainer = document.getElementById('app');

        // Reset scroll
        window.scrollTo(0, 0);

        // Update Navbar based on Auth State
        this.updateNavbar();

        // Protected Routes Check
        // Protected Routes Check
        // Allow rendering if not logged in (renderers will handle limited view or redirect), but strictly enforce for deep views
        const protectedRoutes = ['#dashboard', '#courses', '#course/', '#topic/'];
        const isProtected = protectedRoutes.some(route => hash.startsWith(route));

        if (isProtected && !AppState.isLoggedIn) {
            // Allow a grace period or check if we are still verifying? 
            // For now, if strictly not logged in, go home. 
            // Better UX: Show login modal or similar. Here we redirect.
            window.location.hash = '#home';
            return;
        }

        // Back Button Visibility Logic
        const backContainer = document.getElementById('nav-back-container');
        if (backContainer) {
            const isDeepView = hash.startsWith('#course/') || hash.startsWith('#diagnostic/') || hash.startsWith('#topic/') || hash.startsWith('#search/');
            if (isDeepView) {
                backContainer.classList.remove('hidden');
            } else {
                backContainer.classList.add('hidden');
            }
        }

        if (hash === '#home' || hash === '') {
            if (AppState.isLoggedIn) {
                window.location.hash = '#courses';
                return;
            }
            Renderers.renderLanding('app');
        } else if (hash === '#onboarding') {
            Renderers.renderOnboarding('app');
        } else if (hash === '#dashboard') {
            // Check if specific course dashboard
            Renderers.renderDashboard('app');
        } else if (hash.startsWith('#course/')) {
            const courseId = hash.split('/')[1];
            if (courseId === 'derecho') {
                Renderers.renderCourseDashboard(courseId, 'app');
            } else {
                // Default handling
                appContainer.innerHTML = '<div class="flex h-screen items-center justify-center"><h1 class="text-white">Curso no encontrado</h1></div>';
            }
        } else if (hash.startsWith('#diagnostic/')) {
            const courseId = hash.split('/')[1];
            Renderers.renderDiagnostic(courseId, 'app');
        } else if (hash === '#courses') {
            Renderers.renderCourses('app');
        } else if (hash.startsWith('#search/')) {
            const query = decodeURIComponent(hash.split('/')[1]);
            Renderers.renderSearchResults('app', query);
        } else if (hash.startsWith('#topic/')) {
            // Parse #topic/subject/id
            const [_, subject, topicId] = hash.split('/');
            const topicData = this.getTopicData(subject, topicId);

            if (topicData) {
                // Determine default mode if not set
                if (!AppState.currentMode) AppState.currentMode = 'visual';

                Renderers.renderUniversalCard('app', topicData);
                this.lastRenderedState = { topicId, mode: AppState.currentMode };
            } else {
                appContainer.innerHTML = '<div class="flex h-screen items-center justify-center"><h1 class="text-white text-2xl font-serif">Tema no encontrado</h1></div>';
            }
        } else if (hash === '#profile') {
            Renderers.renderProfile('app');
        } else if (hash === '#settings') {
            Renderers.renderSettings('app');
        } else if (hash === '#onboarding') {
            Renderers.renderOnboarding('app');
        }
    },

    updateNavbar() {
        const authContainer = document.getElementById('auth-container');
        const searchContainer = document.getElementById('search-container');

        if (!authContainer) return;

        if (AppState.isLoggedIn && AppState.user) {
            // Show User Profile with Dropdown
            authContainer.innerHTML = `
                <div class="relative group">
                    <div onclick="const d = document.getElementById('profile-dropdown'); d.classList.toggle('hidden');" 
                         class="flex items-center gap-3 border-l border-white/10 pl-6 cursor-pointer hover:opacity-80 transition-opacity" title="Mi Perfil">
                        <div class="w-8 h-8 rounded-full bg-gradient-to-br from-gray-700 to-gray-900 overflow-hidden border border-white/20">
                            <img src="${AppState.user.avatar}" alt="${AppState.user.name}" class="w-full h-full object-cover">
                        </div>
                        <div class="flex flex-col">
                             <span class="text-sm text-white font-medium">${Renderers.escapeHTML(AppState.user.name)}</span>
                             <span class="text-[10px] text-neon-blue">Estudiante</span>
                        </div>
                    </div>
                    
                    <!-- Dropdown Menu -->
                    <div id="profile-dropdown" class="hidden absolute right-0 mt-2 w-48 bg-dark-card border border-white/10 rounded-xl shadow-xl z-50 overflow-hidden animate-fade-in" 
                         onmouseleave="this.classList.add('hidden')">
                        <div class="px-4 py-3 border-b border-white/10">
                            <p class="text-sm text-white font-medium">${Renderers.escapeHTML(AppState.user.name)}</p>
                            <p class="text-[10px] text-neon-blue uppercase tracking-widest">Estudiante</p>
                        </div>
                        <a href="#profile" class="block px-4 py-2 text-sm text-gray-300 hover:bg-white/5 transition-colors">Mi Perfil</a>
                        <a href="#settings" class="block px-4 py-2 text-sm text-gray-300 hover:bg-white/5 transition-colors">Configuración</a>
                        <div class="border-t border-white/10">
                            <button onclick="AppState.logout()" class="block w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors">
                                Cerrar Sesión
                            </button>
                        </div>
                    </div>
                </div>
            `;

            // Re-attach Search Logic after re-render (since navbar was re-rendered)
            // We use setTimeout to let the DOM settle, though innerHTML is sync.
            setTimeout(() => this.setupSearchListeners(), 0);

            // Show Search
            if (searchContainer) searchContainer.classList.remove('hidden');

        } else {
            // Show Login Button
            authContainer.innerHTML = `
                <button id="btn-login" onclick="window.location.href='login.html'"
                    class="flex items-center gap-2 px-5 py-2 rounded-full border border-neon-blue/30 bg-neon-blue/10 text-neon-blue hover:bg-neon-blue/20 transition-all shadow-[0_0_10px_rgba(0,243,255,0.2)]">
                    <span class="text-sm font-bold tracking-wide">Ingresar</span>
                     <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"></path></svg>
                </button>
            `;
            // Hide Search
            if (searchContainer) searchContainer.classList.add('hidden');
        }
    },

    getTopicData(subject, topicId) {
        if (!CURRICULUM_DATA[subject]) return null;

        const course = CURRICULUM_DATA[subject];

        // 1. Check Legacy Flat Structure
        if (course.topics) {
            const found = course.topics.find(t => t.id === topicId);
            if (found) return found;
        }

        // 2. Check Modular Structure
        if (course.modules) {
            for (const mod of course.modules) {
                const found = mod.topics.find(t => t.id === topicId);
                if (found) return found;
            }
        }

        return null;
    },

    getQuiz(scope, id, countOrConfig) {
        // Validation
        if (!window.QUESTION_BANK || !window.CURRICULUM_DATA) return [];

        const shuffleArray = (array) => {
            const newArr = [...array];
            for (let i = newArr.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
            }
            return newArr;
        };

        const getQuestionsForTopic = (subject, module, topicId) => {
            if (window.QUESTION_BANK[subject] &&
                window.QUESTION_BANK[subject][module] &&
                window.QUESTION_BANK[subject][module][topicId]) {
                return window.QUESTION_BANK[subject][module][topicId];
            }
            return [];
        };

        // 1. Subtopic Scope (Standard Quiz)
        if (scope === 'subtopic') {
            // id = topicId, need to find subject/module context
            // Assuming we pass context or lookup. 
            // Better interface: getQuiz('subtopic', {subject, module, topicId}, count)
            const { subject, module, topicId } = id;
            const pool = getQuestionsForTopic(subject, module, topicId);
            // Even provided directly, it's nice to allow "re-use" of this logic, 
            // but usually we know the topic. We can skip tagging or tag if we want consistency.
            // Let's tag for consistency if we can look up title, but for performance/simplicity maybe just return.
            // Actually, renderers might rely on it if we standardize. 
            // Let's just return shuffled pool for now as standard quiz context is obvious.
            return shuffleArray(pool).slice(0, countOrConfig);
        }

        // 2. Module Scope (Module Exam)
        if (scope === 'module') {
            // id = { subject, moduleId }
            const { subject, moduleId } = id;
            const countPerSubtopic = countOrConfig; // e.g. 3
            let examPool = [];

            const course = window.CURRICULUM_DATA[subject];
            if (!course) return [];

            const moduleData = course.modules ? course.modules.find(m => m.id === moduleId) : null;
            if (!moduleData || !moduleData.topics) return [];

            // Iterate active subtopics
            moduleData.topics.forEach(topic => {
                // Skip the exam topic itself to prevent infinite loop or getting empty questions
                if (topic.type === 'exam') return;

                const topicQuestions = getQuestionsForTopic(subject, moduleId, topic.id);
                // Attach Source Metadata (Clone logic)
                const taggedQuestions = topicQuestions.map(q => ({
                    ...q,
                    _sourceTopicId: topic.id,
                    _sourceTitle: topic.title
                }));

                const selected = shuffleArray(taggedQuestions).slice(0, countPerSubtopic);
                examPool = [...examPool, ...selected];
            });

            return shuffleArray(examPool);
        }

        // 3. Course Scope (Course Exam)
        if (scope === 'course') {
            // id = subjectId (e.g., 'derecho')
            const subject = id;
            const countPerModule = countOrConfig; // e.g. 4
            let examPool = [];

            const course = window.CURRICULUM_DATA[subject];
            if (!course || !course.modules) return [];

            course.modules.forEach(mod => {
                // For course exam, we might take random questions from the module's entire pool
                // Strategy: Gather all questions from module, shuffle, take N
                let modulePool = [];
                mod.topics.forEach(t => {
                    if (t.type === 'exam') return;
                    const qraw = getQuestionsForTopic(subject, mod.id, t.id);
                    const tagged = qraw.map(q => ({
                        ...q,
                        _sourceTopicId: t.id,
                        _sourceTitle: t.title,
                        _sourceModule: mod.title
                    }));
                    modulePool = [...modulePool, ...tagged];
                });

                const selected = shuffleArray(modulePool).slice(0, countPerModule);
                examPool = [...examPool, ...selected];
            });

            return shuffleArray(examPool);
        }

        return [];
    },

    getNextTopic(subject) {
        if (!window.CURRICULUM_DATA || !window.CURRICULUM_DATA[subject]) return null;
        if (!AppState.user || !AppState.user.user_metadata) return null;

        const course = window.CURRICULUM_DATA[subject];
        const completed = AppState.user.user_metadata.completed_topics || [];

        // Flatten topics for linear traversal
        let allTopics = [];
        if (course.modules) {
            course.modules.forEach(m => {
                if (m.topics) allTopics = [...allTopics, ...m.topics];
            });
        } else if (course.topics) {
            allTopics = course.topics;
        }

        // Find first uncompleted topic
        for (const topic of allTopics) {
            if (!completed.includes(topic.id)) {
                return topic;
            }
        }

        // If all completed, return null or specific object indicating completion
        return null; // Implies course finished
    }
};

// Start App
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});