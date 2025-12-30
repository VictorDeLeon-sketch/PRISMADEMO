const Renderers = {
    escapeHTML(str) {
        if (!str) return '';
        return str.replace(/[&<>'"]/g,
            tag => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                "'": '&#39;',
                '"': '&quot;'
            }[tag])
        );
    },

    renderUniversalCard(containerId, topic) {
        const container = document.getElementById(containerId);
        if (!container) return;

        // Container Wrapper
        const wrapperStart = `<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 pt-32">`;
        const wrapperEnd = `</div>`;

        // Header Section
        const headerHTML = `
            <div class="mb-8 flex flex-col md:flex-row justify-between items-end gap-6">
                <div>
                     <button onclick="window.history.back()" class="text-gray-500 hover:text-white mb-4 flex items-center gap-2 text-sm transition-colors">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/></svg>
                        Volver al temario
                    </button>
                    <span class="text-neon-blue text-sm font-bold tracking-wider uppercase mb-2 block">Módulo de Aprendizaje</span>
                    <h1 class="text-4xl md:text-5xl font-display font-bold text-white mb-2 leading-tight">${topic.title}</h1>
                    <p class="text-gray-400 text-lg max-w-2xl">${topic.description}</p>
                </div>
                
                <!-- Cognitive Switch (Hidden for Exams) -->
                ${(topic.type === 'exam' || topic.type === 'final-exam') ? '' : `
                <div class="flex bg-dark-surface p-1 rounded-full border border-white/10 relative shrink-0 w-80 md:w-96">
                    <div id="switch-bg" class="absolute top-1 left-1 bottom-1 w-[calc(33.333%-4px)] bg-gradient-to-r from-neon-blue to-neon-purple rounded-full transition-all duration-300 opacity-80 shadow-[0_0_15px_rgba(0,243,255,0.4)]" 
                         style="transform: ${AppState.currentMode === 'visual' ? 'translateX(100%)' : AppState.currentMode === 'quiz' ? 'translateX(200%)' : 'translateX(0)'}"></div>
                    
                    <button onclick="AppState.setMode('text')" 
                            class="relative z-10 flex-1 py-2 rounded-full text-sm font-bold transition-colors duration-300 text-center ${AppState.currentMode === 'text' ? 'text-white' : 'text-gray-400 hover:text-white'}">
                        Texto
                    </button>
                    <button onclick="AppState.setMode('visual')" 
                            class="relative z-10 flex-1 py-2 rounded-full text-sm font-bold transition-colors duration-300 text-center ${AppState.currentMode === 'visual' ? 'text-white' : 'text-gray-400 hover:text-white'}">
                        Visual
                    </button>
                    <button onclick="AppState.setMode('quiz')" 
                            class="relative z-10 flex-1 py-2 rounded-full text-sm font-bold transition-colors duration-300 text-center ${AppState.currentMode === 'quiz' ? 'text-white' : 'text-gray-400 hover:text-white'}">
                        Evaluación
                    </button>
                </div>
                `}
            </div>
        `;

        // Content Body
        let contentHTML = '';

        if (AppState.currentMode === 'text' || ((topic.type === 'exam' || topic.type === 'final-exam') && AppState.currentMode !== 'quiz')) {
            // Text Mode (or Default for Exam)
            contentHTML = `
                <div class="glass-panel p-8 md:p-12 rounded-2xl animate-fade-in border border-white/5 bg-dark-card/50">
                    <div class="prose prose-invert max-w-none text-gray-300 leading-relaxed">
                        ${topic.content.text}
                    </div>
                </div>
            `;
        } else if (AppState.currentMode === 'quiz') {
            // Quiz Mode - Placeholder container, will be filled by renderTopicQuiz
            // We return a container ID that we can target after header insertion
            contentHTML = `<div id="quiz-container-${topic.id}" class="glass-panel p-8 md:p-12 rounded-2xl animate-fade-in border border-neon-purple/30 bg-dark-card/80 min-h-[400px]"></div>`;
        } else {
            // Visual Mode
            // Check if content is raw HTML (starts with <) or just Mermaid code
            const isCustomHTML = topic.content.visual.trim().startsWith('<');

            if (isCustomHTML) {
                // Custom Layout (Mixed Media)
                contentHTML = `
                    <div class="glass-panel p-6 md:p-8 rounded-2xl animate-fade-in border border-neon-blue/30 shadow-[0_0_30px_rgba(0,243,255,0.1)] bg-dark-card/80" onclick="Renderers.handleVisualClick(event)">
                         <div class="w-full flex flex-col gap-8">
                            ${topic.content.visual}
                         </div>
                    </div>
                `;
            } else {
                // Legacy Mermaid Only
                contentHTML = `
                    <div class="glass-panel p-8 md:p-12 rounded-2xl animate-fade-in flex justify-center items-center min-h-[600px] border border-neon-blue/30 shadow-[0_0_30px_rgba(0,243,255,0.1)] bg-dark-card/80">
                        <div class="mermaid w-full flex justify-center overflow-x-auto">
                            ${topic.content.visual}
                        </div>
                    </div>
                `;
            }
        }

        container.innerHTML = wrapperStart + headerHTML + contentHTML + wrapperEnd;

        // Re-init mermaid if in visual mode
        if (AppState.currentMode === 'visual') {
            /* 
               If custom HTML, we might have multiple mermaid blocks, or explicit class="mermaid".
               If legacy, we have one wrapper. 
               mermaid.init will find all .mermaid classes.
            */
            setTimeout(() => {
                mermaid.init(undefined, document.querySelectorAll('.mermaid'));
            }, 100); // Small delay to ensure DOM is ready
        }

        // Render Quiz if in quiz mode
        if (AppState.currentMode === 'quiz') {
            this.renderTopicQuiz(`quiz-container-${topic.id}`, topic);
        }
    },

    renderTopicQuiz(containerId, topic) {
        const container = document.getElementById(containerId);
        if (!container) return;

        // Parse subject from App state or context (assuming AppState.currentSubject or URL ref)
        // Since we don't have explicit Subject in topic object usually, we rely on Window.location or passed args.
        // Actually App.getTopicData was passed earlier, but we need subject for QUESTION_BANK lookup.
        // Let's rely on the hash for context: #topic/subject/id
        const hash = window.location.hash;
        let subject = '';
        if (hash.startsWith('#topic/')) {
            subject = hash.split('/')[1];
        }

        let pool = [];

        // Determine Scope and Fetch Questions
        if (topic.type === 'exam') {
            // Module Exam
            // We need to know which module. current topic has moduleId.
            pool = App.getQuiz('module', { subject: subject, moduleId: topic.moduleId }, 3); // 3 per subtopic as requested
        } else if (topic.type === 'final-exam') {
            // General Course Exam
            // 5 questions per module (Stratified)
            pool = App.getQuiz('course', subject, 5);
        } else {
            // Standard Topic Quiz
            pool = App.getQuiz('subtopic', { subject: subject, module: topic.moduleId, topicId: topic.id }, 5); // Default 5
        }

        if (!pool || pool.length === 0) {
            container.innerHTML = `<div class="p-8 text-center text-gray-500">No hay evaluación disponible para este tema.</div>`;
            return;
        }

        let currentQ = 0;
        let score = 0;

        let incorrectQs = [];

        const renderQ = (index) => {
            if (index >= pool.length) {
                // Quiz Finished
                const percent = (score / pool.length) * 100;
                const passed = percent >= 80; // 80% strict passing grade

                // Track Progress (Unique Completion)
                if (passed) {
                    AppState.markTopicCompleted(subject, topic.id);
                }

                // Find next topic (Modular Aware)
                let nextTopicId = null;
                const course = window.CURRICULUM_DATA[subject];

                if (course) {
                    if (course.modules) {
                        // Modular Traversal
                        let foundCurrent = false;
                        for (const mod of course.modules) {
                            for (let i = 0; i < mod.topics.length; i++) {
                                if (foundCurrent) {
                                    nextTopicId = mod.topics[i].id;
                                    break;
                                }
                                if (mod.topics[i].id === topic.id) {
                                    foundCurrent = true;
                                    // If this is the last topic of the module, the loop continues to the next module's first topic
                                }
                            }
                            if (nextTopicId) break;
                        }
                    } else if (course.topics) {
                        // Legacy Traversal
                        const idx = course.topics.findIndex(t => t.id === topic.id);
                        if (idx !== -1 && idx < course.topics.length - 1) {
                            nextTopicId = course.topics[idx + 1].id;
                        }
                    }
                }

                // Remedial Logic - Show if ANY incorrect answers exist, regardless of pass/fail
                const showReview = incorrectQs.length > 0;

                // Group incorrect questions by source title
                const reviewMap = new Map(); // Title -> Count
                incorrectQs.forEach(q => {
                    const title = q._sourceTitle || topic.title; // Fallback to current topic if no source
                    reviewMap.set(title, (reviewMap.get(title) || 0) + 1);
                });

                const reviewHTML = showReview ? `
                    <div class="mt-8 bg-white/5 rounded-xl p-6 text-left border ${passed ? 'border-neon-blue/20' : 'border-red-500/20'}">
                        <h4 class="${passed ? 'text-neon-blue' : 'text-red-400'} font-bold mb-4 flex items-center gap-2">
                             <span class="text-xl">${passed ? '💡' : '⚠️'}</span> ${passed ? 'Para perfeccionar tu conocimiento:' : 'Áreas para mejorar:'}
                        </h4>
                        <p class="text-gray-400 text-sm mb-4">Te recomendamos repasar los siguientes temas:</p>
                        <ul class="space-y-3">
                             ${Array.from(reviewMap.keys()).map(title => `
                             <li class="flex items-center gap-3 bg-dark-surface p-3 rounded-lg border border-white/5">
                                <span class="text-neon-pink">📚</span>
                                <span class="text-gray-300 text-sm font-bold">${title}</span>
                             </li>
                             `).join('')}
                        </ul>
                    </div>
                ` : '';

                container.innerHTML = `
                    <div class="text-center py-12 animate-fade-in">
                         <div class="w-32 h-32 mx-auto mb-6 rounded-full flex items-center justify-center ${passed ? 'bg-green-500/20 text-green-400 shadow-[0_0_30px_rgba(34,197,94,0.3)]' : 'bg-red-500/20 text-red-400 shadow-[0_0_30px_rgba(239,68,68,0.3)]'} border-4 ${passed ? 'border-green-500' : 'border-red-500'}">
                            <span class="text-5xl">${passed ? '🏆' : '📝'}</span>
                         </div>
                         <h2 class="text-4xl font-bold text-white mb-2">${passed ? '¡Excelente Trabajo!' : 'Refuerza tus conocimientos'}</h2>
                         <p class="text-gray-400 mb-2 max-w-md mx-auto text-lg">
                            Calificación: <span class="${passed ? 'text-green-400' : 'text-red-400'} font-bold">${Math.round(percent)}%</span>
                         </p>
                         <p class="text-sm text-gray-500 mb-8 lowercase text-opacity-80">(Mínimo requerido: 80%)</p>

                         ${reviewHTML}

                         <div class="mt-10 flex flex-wrap justify-center gap-4">
                             ${passed && topic.type === 'final-exam' ? `
                                <div class="w-full text-center mt-6 animate-fade-in p-8 bg-gradient-to-br from-yellow-500/10 to-red-600/10 rounded-3xl border border-yellow-500/30 shadow-[0_0_50px_rgba(234,179,8,0.2)]">
                                    <div class="text-6xl mb-4">🎓</div>
                                    <h3 class="text-3xl md:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-red-500 mb-4 font-display">¡CURSO COMPLETADO!</h3>
                                    <p class="text-xl text-gray-200 mb-8 max-w-lg mx-auto leading-relaxed">
                                        Felicidades, HAS FINALIZADO satisfactoriamente el curso<br/>
                                        <strong class="text-white">Introducción al Estudio del Derecho</strong>
                                    </p>
                                    
                                    <button onclick="window.location.hash = '#courses'" 
                                            class="px-12 py-5 bg-gradient-to-r from-yellow-500 to-red-600 text-white font-bold rounded-xl hover:scale-105 transition-transform shadow-2xl flex items-center justify-center gap-3 mx-auto text-lg">
                                        <span>🏠</span> Volver al Catálogo
                                    </button>
                                </div>
                             ` : passed && topic.id === 'topic-1-7' ? `
                                <div class="w-full text-center mt-6 animate-fade-in p-6 bg-white/5 rounded-2xl border border-neon-blue/30">
                                    <h3 class="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-neon-blue to-neon-purple mb-2">🎉 ¡Módulo 1 Completado! 🎉</h3>
                                    <p class="text-gray-300 mb-8 max-w-lg mx-auto">Has dominado los fundamentos. Tienes dos caminos ahora:</p>
                                    
                                    <div class="flex flex-col md:flex-row justify-center gap-6">
                                        <button onclick="AppState.setMode('text'); window.location.hash = '#topic/derecho/topic-1-exam'" 
                                                class="group px-8 py-4 bg-neon-purple/20 border border-neon-purple/50 text-white font-bold rounded-xl hover:bg-neon-purple hover:border-neon-purple transition-all flex items-center justify-center gap-3">
                                            <span>📝</span> Realizar Examen Final
                                            <svg class="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
                                        </button>
                                        
                                        <button onclick="window.location.hash = '#topic/derecho/topic-2-1'" 
                                                class="group px-8 py-4 bg-gradient-to-r from-neon-blue to-neon-cyan text-black font-bold rounded-xl hover:scale-105 transition-transform shadow-[0_0_20px_rgba(0,243,255,0.4)] flex items-center justify-center gap-3">
                                            <span>🚀</span> Ir al Módulo 2
                                            <svg class="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6"></path></svg>
                                        </button>
                                    </div>
                                </div>
                             ` : passed && nextTopicId ? `
                                <button onclick="AppState.setMode(AppState.user?.user_metadata?.preferred_mode || 'text'); window.location.hash = '#topic/${subject}/${nextTopicId}'" 
                                        class="px-10 py-4 bg-gradient-to-r from-neon-blue to-neon-purple text-white font-bold rounded-xl hover:scale-105 transition-transform shadow-[0_0_20px_rgba(0,243,255,0.4)] flex items-center gap-3">
                                    Continuar al Siguiente Tema <span class="text-xl">👉</span>
                                </button>
                             ` : `
                                <button onclick="AppState.setMode('text')" 
                                        class="px-8 py-3 border border-white/20 text-gray-300 rounded-xl hover:bg-white/10 transition-colors flex items-center gap-2">
                                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path></svg>
                                    Repasar Tema
                                </button>
                                <button onclick="Renderers.renderTopicQuiz('${containerId}', App.getTopicData('${subject}', '${topic.id}'))"
                                        class="px-8 py-3 bg-neon-pink text-white font-bold rounded-xl hover:bg-neon-pink/80 transition-colors shadow-[0_0_15px_rgba(255,0,170,0.3)] flex items-center gap-2">
                                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
                                    Reintentar Prueba
                                </button>
                             `}
                         </div>
                    </div>
                `;
                return;
            }

            const q = pool[index];

            // Shuffle options if not already shuffled (to avoid re-shuffling on re-renders if we were storing state, but here we rebuild)
            // Actually, we should shuffle once when generating the pool or here but we need to verify.
            // Since renderQ is called recursively for next question, we can do it here.
            // CAUTION: modifying 'q' directly in 'pool' might affect review if we don't clone. 
            // App.getQuiz returns clones? Yes, mostly.

            // Helper to shuffle options
            if (!q._shuffled) {
                const optionsWithIndex = q.options.map((opt, i) => ({ opt, originalIndex: i }));
                // Fisher-Yates shuffle
                for (let i = optionsWithIndex.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [optionsWithIndex[i], optionsWithIndex[j]] = [optionsWithIndex[j], optionsWithIndex[i]];
                }

                q.options = optionsWithIndex.map(o => o.opt);
                // Update correct index
                const newCorrectIndex = optionsWithIndex.findIndex(o => o.originalIndex === q.correct);
                q.correct = newCorrectIndex;
                q._shuffled = true;
            }
            container.innerHTML = `
                <div class="max-w-2xl mx-auto animate-fade-in relative">
                    <!-- Progress Bar -->
                    <div class="w-full bg-gray-800 h-1.5 rounded-full mb-8 overflow-hidden">
                        <div class="bg-gradient-to-r from-neon-blue to-neon-purple h-full transition-all duration-500" style="width: ${((index + 1) / pool.length) * 100}%"></div>
                    </div>

                    <div class="flex justify-between items-center mb-8 text-sm text-gray-400 uppercase tracking-widest font-mono">
                        <span>Pregunta ${index + 1} de ${pool.length}</span>
                        <!-- Hidden Score -->
                    </div>

                    <h3 class="text-2xl md:text-3xl font-bold text-white mb-10 leading-relaxed font-display">${q.question}</h3>

                    <div class="space-y-4">
                        ${q.options.map((opt, i) => `
                            <button id="q-btn-${i}" 
                                    class="w-full text-left p-5 rounded-2xl border border-white/10 hover:border-neon-purple/50 bg-white/5 hover:bg-white/10 transition-all duration-200 group flex items-center gap-5 relative overflow-hidden">
                                <span class="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-sm font-bold group-hover:bg-neon-purple group-hover:text-white transition-colors shrink-0">
                                    ${String.fromCharCode(65 + i)}
                                </span>
                                <span class="text-gray-300 group-hover:text-white transition-colors text-lg">${opt}</span>
                            </button>
                        `).join('')}
                    </div>
                </div>
            `;

            // Attach listeners properly
            q.options.forEach((_, i) => {
                const btn = document.getElementById(`q-btn-${i}`);
                if (btn) {
                    btn.onclick = () => {
                        const isCorrect = i === q.correct;
                        if (isCorrect) {
                            score++;
                            // Visual Feedback Correct
                            btn.classList.add('border-green-500', 'bg-green-500/10');
                        } else {
                            // Visual Feedback Incorrect
                            btn.classList.add('border-red-500', 'bg-red-500/10');
                            incorrectQs.push(q);
                        }

                        // Disable all buttons
                        q.options.forEach((__, j) => {
                            const otherBtn = document.getElementById(`q-btn-${j}`);
                            otherBtn.disabled = true;
                            if (j !== i) otherBtn.classList.add('opacity-50');
                        });

                        // Next Question Delay
                        setTimeout(() => {
                            renderQ(index + 1);
                        }, 800);
                    };
                }
            });
        };

        renderQ(0);
    },

    renderLanding(containerId) {
        const container = document.getElementById(containerId);
        container.innerHTML = `
            <div class="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center text-center pt-24 pb-20">
                <!-- Main Heading -->
                <h1 class="text-6xl md:text-8xl font-serif font-bold text-white mb-4 leading-tight animate-fade-in tracking-tight">
                    Domina el conocimiento.<br>
                    <span class="text-transparent bg-clip-text bg-gradient-to-r from-neon-blue via-neon-purple to-neon-pink">A tu manera.</span>
                </h1>
                
                <!-- Description -->
                <div class="max-w-3xl mx-auto mb-2 space-y-6 animate-fade-in" style="animation-delay: 0.2s">
                    <p class="text-xl md:text-2xl text-gray-400 font-light leading-relaxed">
                        La plataforma de estudio adaptativa. Cambia instantáneamente entre explicaciones de texto profundo y diagramas visuales interactivos.
                    </p>
                    <p class="text-sm uppercase tracking-[0.2em] text-gray-500 font-mono">Diseñado para tu cerebro.</p>
                </div>

                <!-- Hero Diagram (Centered & Larger) -->
                <div class="w-full max-w-[1400px] mx-auto relative animate-fade-in my-16" style="animation-delay: 0.4s">
                     <!-- Abstract lines visualization -->
                    <div class="relative flex items-center justify-center min-h-[500px] gap-8">
                         
                         <!-- Left Wrapper (Balances Center) -->
                         <div class="flex-1 flex justify-end hidden md:flex">
                             <!-- Left Side: Text Representation (Cyan Lines - Wider: w-96) -->
                             <div class="relative w-96 h-[400px] flex flex-col justify-center gap-4 opacity-70">
                                <!-- Simulated Text Paragraphs -->
                                <div class="flex flex-col gap-3">
                                    <div class="h-1.5 w-full bg-gradient-to-r from-transparent to-neon-blue/40 rounded-full"></div>
                                    <div class="h-1.5 w-[90%] bg-gradient-to-r from-transparent to-neon-blue/40 rounded-full"></div>
                                    <div class="h-1.5 w-full bg-gradient-to-r from-transparent to-neon-blue/40 rounded-full"></div>
                                    <div class="h-1.5 w-[85%] bg-gradient-to-r from-transparent to-neon-blue/40 rounded-full"></div>
                                </div>
                                 <div class="flex flex-col gap-3">
                                    <div class="h-1.5 w-full bg-gradient-to-r from-transparent to-neon-blue/40 rounded-full"></div>
                                    <div class="h-1.5 w-[80%] bg-gradient-to-r from-transparent to-neon-blue/40 rounded-full"></div>
                                    <div class="h-1.5 w-full bg-gradient-to-r from-transparent to-neon-blue/40 rounded-full"></div>
                                </div>
                                 <div class="flex flex-col gap-3">
                                    <div class="h-1.5 w-[95%] bg-gradient-to-r from-transparent to-neon-blue/40 rounded-full"></div>
                                    <div class="h-1.5 w-full bg-gradient-to-r from-transparent to-neon-blue/40 rounded-full"></div>
                                    <div class="h-1.5 w-[75%] bg-gradient-to-r from-transparent to-neon-blue/40 rounded-full"></div>
                                    <div class="h-1.5 w-full bg-gradient-to-r from-transparent to-neon-blue/40 rounded-full"></div>
                                </div>
                                 <div class="flex flex-col gap-3">
                                    <div class="h-1.5 w-full bg-gradient-to-r from-transparent to-neon-blue/40 rounded-full"></div>
                                    <div class="h-1.5 w-[90%] bg-gradient-to-r from-transparent to-neon-blue/40 rounded-full"></div>
                                </div>
                                
                                <!-- Glow -->
                                <div class="absolute inset-0 bg-neon-blue/5 blur-xl"></div>
                             </div>
                         </div>
    
                         <!-- Center: The Switch (Prisma Play Button - Image) -->
                         <div class="relative z-10 shrink-0 group cursor-pointer hover:scale-110 transition-transform duration-500">
                             <!-- Play Button Icon Image -->
                             <div class="w-32 h-32 relative flex items-center justify-center">
                                <img src="assets/hero_logo.png" alt="Switch Cognitivo" 
                                     class="w-full h-full object-contain drop-shadow-[0_0_30px_rgba(0,243,255,0.4)]">
                             </div>
                             
                             <!-- Connecting Lines -->
                             <div class="absolute right-full top-1/2 w-20 h-[2px] bg-gradient-to-r from-transparent to-neon-blue transform -translate-y-1/2 -mr-2"></div>
                             <div class="absolute left-full top-1/2 w-20 h-[2px] bg-gradient-to-l from-transparent to-neon-pink transform -translate-y-1/2 -ml-2"></div>
                             
                             <!-- Pulsing ring -->
                             <div class="absolute inset-0 rounded-full border border-white/5 animate-ping opacity-20"></div>
                         </div>
    
                         <!-- Right Wrapper (Balances Center) -->
                         <div class="flex-1 flex justify-start hidden md:flex">
                             <!-- Right Side: Visual Representation (Neon Flowchart) -->
                             <div class="relative w-[500px] h-[350px] opacity-90">
                                <svg class="w-full h-full drop-shadow-[0_0_20px_rgba(255,0,170,0.2)]" viewBox="0 0 500 350" fill="none">
                                    <!-- Root Node -->
                                    <rect x="0" y="160" width="60" height="40" rx="10" stroke="#ff00aa" stroke-width="2" fill="none"/>
                                    <circle cx="60" cy="180" r="3" fill="#ff00aa"/>
                                    
                                    <!-- Level 1 Split -->
                                    <path d="M60 180 C 100 180, 100 100, 140 100" stroke="#ff00aa" stroke-width="1.5" fill="none"/>
                                    <rect x="140" y="80" width="50" height="40" rx="10" stroke="#ff00aa" stroke-width="2" fill="none"/>
                                    
                                    <path d="M60 180 L 140 180" stroke="#ff00aa" stroke-width="1.5" fill="none"/>
                                    <rect x="140" y="160" width="50" height="40" rx="10" stroke="#ff00aa" stroke-width="2" fill="none"/>
                                    
                                    <path d="M60 180 C 100 180, 100 260, 140 260" stroke="#ff00aa" stroke-width="1.5" fill="none"/>
                                    <rect x="140" y="240" width="50" height="40" rx="10" stroke="#fae100" stroke-width="2" fill="none"/> <!-- Transition to Yellow -->

                                    <!-- Level 2 Split (Top) -->
                                    <path d="M190 100 C 210 100, 210 50, 230 50" stroke="#ff00aa" stroke-width="1.5" fill="none"/>
                                    <rect x="230" y="30" width="50" height="40" rx="10" stroke="#ff00aa" stroke-width="2" fill="none"/>
                                    
                                    <path d="M190 100 C 210 100, 210 130, 230 130" stroke="#ff00aa" stroke-width="1.5" fill="none"/>
                                    <rect x="230" y="110" width="50" height="40" rx="10" stroke="#ff00aa" stroke-width="2" fill="none"/>

                                    <!-- Level 2 Split (Middle) -->
                                    <path d="M190 180 L 260 180" stroke="#fae100" stroke-width="1.5" fill="none"/>
                                    <rect x="260" y="160" width="50" height="40" rx="10" stroke="#fae100" stroke-width="2" fill="none"/>
                                    
                                    <!-- Level 2 Split (Bottom) -->
                                    <path d="M190 260 C 210 260, 210 300, 230 300" stroke="#fae100" stroke-width="1.5" fill="none"/>
                                    <rect x="230" y="280" width="50" height="40" rx="10" stroke="#fae100" stroke-width="2" fill="none"/>
                                    
                                    <!-- Level 3 Nodes (Far Right) -->
                                    <path d="M280 50 L 320 50" stroke="#ff00aa" stroke-width="1.5" fill="none"/>
                                    <circle cx="330" cy="50" r="10" stroke="#ff00aa" stroke-width="2" fill="none"/>
                                    
                                    <path d="M310 180 L 350 180" stroke="#fae100" stroke-width="1.5" fill="none"/>
                                    <rect x="350" y="160" width="40" height="40" rx="8" stroke="#fae100" stroke-width="2" fill="none"/>
                                    <rect x="350" y="210" width="40" height="40" rx="8" stroke="#fae100" stroke-width="2" fill="none"/>
                                    
                                    <path d="M280 300 L 320 300" stroke="#fae100" stroke-width="1.5" fill="none"/>
                                    <rect x="320" y="280" width="40" height="40" rx="8" stroke="#fae100" stroke-width="2" fill="none"/>

                                </svg>
                                <div class="absolute inset-0 bg-neon-pink/5 blur-xl"></div>
                             </div>
                         </div>
                    </div>
                </div>

                <!-- CTA Button (Centered below diagram) -->
                <div class="animate-fade-in flex flex-col items-center gap-6" style="animation-delay: 0.6s">
                   <button onclick="AppState.isLoggedIn ? window.location.hash = '#courses' : window.location.href = 'login.html'" 
                            class="group relative px-10 py-4 rounded-full overflow-hidden transition-all duration-300 hover:scale-105 shadow-[0_0_20px_rgba(0,243,255,0.4)]">
                        <!-- Gradient Background -->
                        <div class="absolute inset-0 bg-gradient-to-r from-neon-blue to-neon-pink opacity-100"></div>
                        <div class="absolute inset-0 bg-white/20 group-hover:opacity-0 transition-opacity"></div>
                        
                        <span class="relative z-10 text-white font-bold text-lg tracking-wide">Prueba el Switch Cognitivo</span>
                    </button>
                    
                    <a href="#" class="text-gray-500 hover:text-white text-sm border-b border-gray-700 hover:border-white transition-all pb-0.5">
                        Explorar temario oficial (COMIPEMS y más)
                    </a>
                </div>
            </div>
        `;
    },

    renderOnboarding(containerId) {
        const container = document.getElementById(containerId);
        container.innerHTML = `
            <div class="min-h-screen flex items-center justify-center relative overflow-hidden">
                <!-- Brain Glow Background -->
                 <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-neon-purple/10 rounded-full blur-[120px] pointer-events-none"></div>

                <div class="relative z-10 text-center max-w-2xl px-6 animate-fade-in">
                    <div class="flex justify-between items-center mb-12 text-sm text-gray-500 font-mono uppercase tracking-widest">
                        <span>PRISMA</span>
                        <span>Bienvenido</span>
                        <div class="flex items-center gap-2">
                             <div class="w-8 h-1 bg-neon-blue rounded-full"></div>
                             <span class="text-white"> Configuración</span>
                        </div>
                    </div>

                    <h1 class="text-5xl md:text-6xl font-serif text-white mb-6">
                        ¡Hola, Estudiante! <br>
                        <span class="text-gray-400">Configuremos tu camino.</span>
                    </h1>

                    <!-- Brain Icon / Graphic -->
                     <div class="my-12 relative inline-block">
                        <svg class="w-48 h-48 text-neon-pink animate-float mx-auto drop-shadow-[0_0_15px_rgba(255,0,170,0.5)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="0.5">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                             <!-- Simple brain representation -->
                             <circle cx="12" cy="12" r="9" stroke="url(#gradient)" stroke-width="1.5" stroke-linecap="round" />
                             <defs>
                                <linearGradient id="gradient" x1="0" y1="0" x2="1" y2="1">
                                    <stop offset="0%" stop-color="#00f3ff" />
                                    <stop offset="100%" stop-color="#ff00aa" />
                                </linearGradient>
                            </defs>
                        </svg>
                        
                        <!-- Connection Line to Checklist -->
                        <div class="hidden md:block absolute top-1/2 left-full w-24 h-[1px] bg-gradient-to-r from-neon-pink to-transparent border-t border-dashed border-gray-600"></div>
                    </div>

                    <p class="text-gray-400 text-lg mb-10 leading-relaxed">
                        Para empezar, necesitamos conocer tu estilo de aprendizaje y detectar tus áreas de oportunidad. Este breve diagnóstico adaptará PRISMA a ti.
                    </p>

                    <button onclick="window.location.hash = '#dashboard'" 
                            class="group relative px-10 py-4 bg-transparent overflow-hidden rounded-xl transition-all hover:scale-105">
                        <div class="absolute inset-0 bg-gradient-to-r from-neon-blue to-neon-pink opacity-80 group-hover:opacity-100 transition-opacity blur-md"></div>
                        <div class="absolute inset-0 bg-gradient-to-r from-neon-blue to-neon-pink opacity-50 group-hover:opacity-100 transition-opacity"></div>
                        <span class="relative z-10 text-white font-bold tracking-wide">Iniciar Examen Diagnóstico</span>
                    </button>
                 
                    <p class="mt-6 text-sm text-gray-600">Duración estimada: 15 minutos. No tiene calificación.</p>
                </div>
            </div>
        `;
    },

    renderDashboard(containerId) {
        const container = document.getElementById(containerId);
        // Using mock data for dashboard content
        const recentSims = [
            { id: 1, score: 85, date: 'Hace 2 días' },
            { id: 2, score: 90, date: 'Hace 2 días' },
            { id: 3, score: 75, date: 'Hace 2 días' },
        ];

        container.innerHTML = `
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 pt-32">
                <!-- Header -->
                <div class="flex justify-between items-end mb-12">
                     <div>
                        <h1 class="text-4xl font-serif text-white mb-2">Curso: Ingreso a Media Superior</h1>
                        <p class="text-gray-400">Continúa donde te quedaste</p>
                    </div>
                    <div class="flex gap-4">
                        <button onclick="window.location.hash='courses'" class="text-gray-400 hover:text-white transition-colors">Ver todos los cursos</button>
                    </div>
                </div>

                <!-- Main Progress Card -->
                <div class="bg-dark-card border border-white/10 rounded-3xl p-8 mb-12 relative overflow-hidden group">
                     <div class="absolute top-0 right-0 w-64 h-64 bg-neon-blue/10 blur-[80px] rounded-full group-hover:bg-neon-blue/20 transition-all"></div>
                     
                     <div class="flex flex-col md:flex-row items-center justify-between gap-8 relative z-10">
                        <div class="flex items-center gap-6">
                            <!-- Circular Progress Placeholder -->
                            <div class="relative w-24 h-24 flex items-center justify-center">
                                <svg class="w-full h-full transform -rotate-90">
                                    <circle cx="48" cy="48" r="40" stroke="#333" stroke-width="8" fill="none" />
                                    <circle cx="48" cy="48" r="40" stroke="#00f3ff" stroke-width="8" fill="none" stroke-dasharray="251.2" stroke-dashoffset="125.6" stroke-linecap="round" class="drop-shadow-[0_0_10px_rgba(0,243,255,0.5)]" />
                                </svg>
                            </div>
                            <div>
                                <h2 class="text-3xl font-bold text-white mb-1">50% <span class="text-base font-normal text-gray-400">Dominado</span></h2>
                                <p class="text-neon-blue text-sm">Buen progreso, sigue así.</p>
                            </div>
                        </div>
                        
                        <button onclick="window.location.hash = 'topic/biologia/celula-mitosis'" 
                                class="px-8 py-3 rounded-lg border border-neon-pink/50 text-white hover:bg-neon-pink/10 transition-colors shadow-[0_0_15px_rgba(255,0,170,0.2)]">
                            Continuar Aprendizaje
                        </button>
                     </div>
                </div>

                <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <!-- Modules Grid -->
                    <div class="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
                         <!-- Module Card 1 -->
                         <div class="bg-dark-surface border border-white/5 rounded-xl p-6 hover:border-neon-blue/30 transition-all hover:-translate-y-1 group">
                            <div class="w-12 h-12 rounded-lg bg-gray-800 flex items-center justify-center mb-4 text-neon-blue border border-white/5">
                                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path></svg>
                            </div>
                            <h3 class="text-white font-bold mb-2">Módulo 1: Habilidades Verbales</h3>
                            <div class="w-full bg-gray-800 h-1.5 rounded-full mb-4 overflow-hidden">
                                <div class="bg-neon-blue h-full w-[80%] shadow-[0_0_10px_rgba(0,243,255,0.5)]"></div>
                            </div>
                            <ul class="space-y-2 text-sm text-gray-500">
                                <li class="flex items-center gap-2 text-neon-blue"><span class="w-1 h-1 bg-current rounded-full"></span> Comprensión de Lectura</li>
                                <li class="flex items-center gap-2 text-neon-blue"><span class="w-1 h-1 bg-current rounded-full"></span> Analogías</li>
                            </ul>
                         </div>

                         <!-- Module Card 2 -->
                         <div class="bg-dark-surface border border-white/5 rounded-xl p-6 hover:border-neon-blue/30 transition-all hover:-translate-y-1 group">
                             <div class="w-12 h-12 rounded-lg bg-gray-800 flex items-center justify-center mb-4 text-neon-green border border-white/5">
                                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>
                            </div>
                            <h3 class="text-white font-bold mb-2">Módulo 2: Matemáticas</h3>
                             <div class="w-full bg-gray-800 h-1.5 rounded-full mb-4 overflow-hidden">
                                <div class="bg-neon-blue h-full w-[60%] shadow-[0_0_10px_rgba(0,243,255,0.5)]"></div>
                            </div>
                             <ul class="space-y-2 text-sm text-gray-500">
                                <li class="flex items-center gap-2 text-neon-blue"><span class="w-1 h-1 bg-current rounded-full"></span> Sucesiones</li>
                                <li class="flex items-center gap-2 text-gray-600"><span class="w-1 h-1 bg-current rounded-full"></span> Imaginación Espacial</li>
                            </ul>
                         </div>

                         <!-- Module Card 3 -->
                         <div class="bg-dark-surface border border-white/5 rounded-xl p-6 hover:border-neon-yellow/30 transition-all hover:-translate-y-1 group">
                             <div class="w-12 h-12 rounded-lg bg-gray-800 flex items-center justify-center mb-4 text-neon-yellow border border-white/5">
                                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path></svg>
                            </div>
                            <h3 class="text-white font-bold mb-2">Módulo 3: Español</h3>
                             <div class="w-full bg-gray-800 h-1.5 rounded-full mb-4 overflow-hidden">
                                <div class="bg-neon-blue h-full w-[100%] shadow-[0_0_10px_rgba(0,243,255,0.5)]"></div>
                            </div>
                            <ul class="space-y-2 text-sm text-gray-500">
                                <li class="flex items-center gap-2 text-neon-blue"><span class="w-1 h-1 bg-current rounded-full"></span> Gramática</li>
                            </ul>
                         </div>

                         <!-- Module Card 4 -->
                         <div class="bg-dark-surface border border-white/5 rounded-xl p-6 hover:border-neon-pink/30 transition-all hover:-translate-y-1 group">
                             <div class="w-12 h-12 rounded-lg bg-gray-800 flex items-center justify-center mb-4 text-neon-pink border border-white/5">
                                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 7h6m0 3.666A5.002 5.002 0 0115 17H9a5.002 5.002 0 01-1.556-9.334A5.992 5.992 0 0112 6c3.126 0 5.688 2.378 5.952 5.44.02.245-.181.465-.436.436A6 6 0 006 12c0 3.314 2.686 6 6 6 3.036 0 5.567-2.25 5.953-5.234a.456.456 0 00-.437-.488A5.992 5.992 0 0112 12z"></path></svg>
                            </div>
                            <h3 class="text-white font-bold mb-2">Módulo 4: Ciencias</h3>
                             <div class="w-full bg-gray-800 h-1.5 rounded-full mb-4 overflow-hidden">
                                <div class="bg-neon-pink h-full w-[20%] shadow-[0_0_10px_rgba(255,0,170,0.5)]"></div>
                            </div>
                             <ul class="space-y-2 text-sm text-gray-500">
                                <li class="flex items-center gap-2 text-neon-pink"><span class="w-1 h-1 bg-current rounded-full"></span> Física</li>
                                <li class="flex items-center gap-2 text-gray-600"><span class="w-1 h-1 bg-current rounded-full"></span> Química</li>
                            </ul>
                         </div>
                    </div>

                    <!-- Sidebar -->
                    <div class="lg:col-span-1">
                        <div class="bg-dark-card border border-white/10 rounded-2xl p-6 mb-6">
                            <button class="w-full py-4 bg-neon-yellow text-black font-bold rounded-xl mb-6 hover:bg-yellow-400 transition-colors shadow-[0_0_15px_rgba(250,204,21,0.4)]">
                                Realizar Nuevo Simulacro
                            </button>
                            <h3 class="text-white font-bold mb-4">Resultados Recientes</h3>
                            <ul class="space-y-4">
                                ${recentSims.map(sim => `
                                    <li class="flex justify-between items-center text-sm p-3 rounded-lg hover:bg-white/5 transition-colors cursor-pointer">
                                        <span class="text-gray-400">Simulacro ${sim.id}</span>
                                        <div class="flex items-center gap-3">
                                            <span class="text-white font-bold">${sim.score}%</span>
                                            <span class="text-xs text-gray-600">${sim.date}</span>
                                        </div>
                                    </li>
                                `).join('')}
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    renderCourses(containerId) {
        const container = document.getElementById(containerId);

        // Progress Logic for Derecho
        const derechoStatus = AppState.courseProgress.derecho || { started: false, progress: 0 };
        const isDerechoStarted = derechoStatus.started;

        container.innerHTML = `
             <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 pt-32">
                <div class="text-center mb-16">
                    <h1 class="text-5xl font-serif text-white mb-4">Explora Nuestros Cursos</h1>
                    <p class="text-gray-400 text-lg">Rutas de aprendizaje adaptativas. Tu camino, tu ritmo.</p>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    <!-- Featured Course Card (COMIPEMS) -->
                    <div class="relative bg-dark-card border border-neon-blue/50 rounded-3xl p-8 overflow-hidden group hover:scale-[1.02] transition-transform duration-300 shadow-[0_0_30px_rgba(0,243,255,0.1)]">
                         <div class="absolute inset-0 bg-gradient-to-b from-transparent to-neon-blue/5"></div>
                         
                         <!-- Icon -->
                         <div class="relative w-16 h-16 mb-8 text-neon-blue">
                            <svg viewBox="0 0 24 24" fill="none" class="w-full h-full" stroke="currentColor" stroke-width="1.5">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                            </svg>
                         </div>

                         <h3 class="relative text-2xl font-bold text-white mb-2 leading-tight">
                            Ingreso a Media Superior <br>(COMIPEMS)
                         </h3>
                         
                         <p class="relative text-gray-400 text-sm mb-8 leading-relaxed">
                            Temario oficial completo. Domina los 128 temas con nuestro Switch Cognitivo.
                         </p>

                         <div class="relative mt-auto">
                            ${AppState.courseProgress.comipems?.started ? `
                                <div class="flex justify-between text-xs text-gray-500 mb-2 font-mono uppercase">
                                    <span>Progreso</span>
                                    <span>${AppState.courseProgress.comipems.progress}%</span>
                                </div>
                                <div class="w-full bg-gray-800 h-1 rounded-full mb-6">
                                    <div class="bg-gray-700 h-full w-[${AppState.courseProgress.comipems.progress}%] rounded-full bg-neon-blue shadow-[0_0_5px_rgba(0,243,255,0.8)]"></div>
                                </div>
                                <button onclick="window.location.hash = '#dashboard'" 
                                        class="w-full py-4 rounded-xl bg-gradient-to-r from-neon-blue to-neon-pink text-white font-bold hover:opacity-90 transition-opacity shadow-[0_0_20px_rgba(0,243,255,0.3)]">
                                    Continuar Ruta
                                </button>
                            ` : `
                                <button onclick="window.location.hash = '#diagnostic/comipems'" class="w-full py-4 rounded-xl border border-neon-blue/50 text-white font-bold hover:bg-neon-blue/10 transition-colors shadow-[0_0_10px_rgba(0,243,255,0.2)]">
                                    Iniciar Curso
                                </button>
                            `}
                         </div>
                    </div>

                    <!-- Course Card 2 (Derecho) -->
                    <!-- Dynamic styling based on started status -->
                    <div class="${isDerechoStarted ?
                'relative bg-dark-card border border-neon-pink/50 rounded-3xl p-8 overflow-hidden group hover:scale-[1.02] transition-transform duration-300 shadow-[0_0_30px_rgba(255,0,170,0.1)]' :
                'bg-dark-surface border border-white/5 rounded-3xl p-8 hover:bg-white/5 transition-all group'}">
                         
                         ${isDerechoStarted ? '<div class="absolute inset-0 bg-gradient-to-b from-transparent to-neon-pink/5"></div>' : ''}

                         <div class="w-14 h-14 mb-6 text-neon-pink relative z-10">
                             <svg viewBox="0 0 24 24" fill="none" class="w-full h-full" stroke="currentColor" stroke-width="1.5">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
                            </svg>
                         </div>
                         <h3 class="text-xl font-bold text-white mb-2 relative z-10">Introducción al Estudio del Derecho</h3>
                         <p class="text-gray-400 text-sm mb-8 relative z-10">Fundamentos legales y pensamiento jurídico. Estructuras visuales para conceptos complejos.</p>
                         
                         <!-- Action Area -->
                         <div class="relative z-10 mt-auto">
                             ${isDerechoStarted ? `
                                <div class="flex justify-between text-xs text-gray-500 mb-2 font-mono uppercase">
                                    <span>Progreso</span>
                                    <span>${derechoStatus.progress}%</span>
                                </div>
                                <div class="w-full bg-gray-800 h-1 rounded-full mb-6">
                                    <div class="bg-neon-pink h-full w-[${derechoStatus.progress}%] rounded-full shadow-[0_0_5px_rgba(255,0,170,0.8)]"></div>
                                </div>
                                <button onclick="window.location.hash = '#course/derecho'" class="w-full py-4 rounded-xl bg-gradient-to-r from-neon-pink to-neon-purple text-white font-bold hover:opacity-90 transition-opacity shadow-[0_0_20px_rgba(255,0,170,0.3)]">
                                    Continuar Ruta
                                </button>
                             ` : `
                                <button onclick="window.location.hash = '#diagnostic/derecho'" class="px-6 py-2 rounded-lg border border-neon-pink/50 text-white text-sm hover:bg-neon-pink/10 transition-colors shadow-[0_0_10px_rgba(255,0,170,0.2)]">
                                    Iniciar Curso
                                </button>
                             `}
                         </div>
                    </div>

                    <!-- Course Card 3 (Superior) -->
                    <div class="bg-dark-surface border border-white/5 rounded-3xl p-8 hover:bg-white/5 transition-all group">
                         <div class="w-14 h-14 mb-6 text-neon-yellow">
                             <svg viewBox="0 0 24 24" fill="none" class="w-full h-full" stroke="currentColor" stroke-width="1.5">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M12 14l9-5-9-5-9 5 9 5z" />
                                <path stroke-linecap="round" stroke-linejoin="round" d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
                            </svg>
                         </div>
                         <h3 class="text-xl font-bold text-white mb-2">Ingreso a Nivel Superior (UNAM/Ceneval)</h3>
                         <p class="text-gray-400 text-sm mb-8">Preparación estratégica para la universidad. Matemáticas avanzadas y comprensión lectora.</p>
                         <button disabled class="px-6 py-2 rounded-lg border border-white/10 text-gray-500 text-sm cursor-not-allowed">
                            Próximamente
                         </button>
                    </div>
                </div>
             </div>
        `;
    },

    renderDiagnostic(courseId, containerId) {
        const container = document.getElementById(containerId);
        // Map courseId to readable titles/colors usually, focusing on Derecho for now
        const courseName = courseId === 'derecho' ? 'Introducción al Derecho' : 'Diagnóstico';

        container.innerHTML = `
            <div class="min-h-screen flex items-center justify-center p-4">
                <div class="max-w-2xl w-full bg-dark-card border border-white/10 rounded-3xl p-10 relative overflow-hidden animate-fade-in">
                    <div class="absolute top-0 right-0 w-64 h-64 bg-neon-pink/10 blur-[80px] rounded-full"></div>
                    
                    <h1 class="text-4xl font-serif text-white mb-6">Examen Diagnóstico: <span class="text-neon-pink">${courseName}</span></h1>
                    <p class="text-gray-400 mb-8 text-lg leading-relaxed">
                        Antes de comenzar, necesitamos evaluar tus conocimientos previos para adaptar la ruta de aprendizaje a tus necesidades. Este examen no afecta tu calificación final, solo nos ayuda a guiarte mejor.
                    </p>

                    <div class="bg-dark-surface p-6 rounded-xl border border-white/5 mb-8">
                        <ul class="space-y-3 text-sm text-gray-400">
                            <li class="flex items-center gap-3">
                                <svg class="w-5 h-5 text-neon-pink" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                Duración estimada: 20 minutos
                            </li>
                            <li class="flex items-center gap-3">
                                <svg class="w-5 h-5 text-neon-pink" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                30 Preguntas de opción múltiple
                            </li>
                        </ul>
                    </div>

                    <div class="flex gap-4">
                        <button onclick="AppState.updateCourseStatus('${courseId}', { started: true, progress: 5 }); window.location.hash = '#course/${courseId}'" 
                            class="flex-1 py-4 bg-neon-pink text-white font-bold rounded-xl hover:bg-neon-pink/90 transition-colors shadow-[0_0_20px_rgba(255,0,170,0.4)]">
                            Comenzar Examen
                        </button>
                        <button onclick="window.history.back()" 
                            class="px-6 py-4 border border-white/10 text-gray-400 font-bold rounded-xl hover:bg-white/5 transition-colors">
                            Volver
                        </button>
                    </div>
                </div>
            </div>
        `;
    },

    renderCourseDashboard(courseId, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        console.log("Rendering Dashboard for:", courseId);

        const courseData = window.CURRICULUM_DATA ? window.CURRICULUM_DATA[courseId] : null;

        if (!courseData) {
            console.error(`No curriculum data found for ${courseId}`);
            container.innerHTML = `<div class="p-8 text-center text-red-500">Error: No se encontraron datos para el curso ${courseId}</div>`;
            return;
        }

        let firstTopicId = '';
        let contentHTML = '';

        // Handle Modular vs Flat Structure
        if (courseData.modules) {
            // Modular Structure
            // Find first topic for the "Start" button
            const firstModule = courseData.modules[0];
            if (firstModule && firstModule.topics && firstModule.topics.length > 0) {
                firstTopicId = firstModule.topics[0].id;
            }

            // Generate HTML for Modules and Topics
            contentHTML = courseData.modules.map((module, mIndex) => `
                <div class="mb-12">
                    <h2 class="text-2xl font-bold text-white mb-6 flex items-center gap-3">
                        <span class="bg-white/10 w-8 h-8 rounded-lg flex items-center justify-center text-sm">${mIndex + 1}</span>
                        ${module.title}
                    </h2>
                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        ${module.topics.map((topic, tIndex) => `
                            <div class="bg-dark-surface border border-white/5 rounded-xl p-6 hover:border-neon-pink/50 transition-all cursor-pointer group" 
                                 onclick="window.location.hash='#topic/${courseId}/${topic.id}'">
                                <span class="text-neon-pink text-xs font-bold tracking-widest uppercase mb-2 block">Tema ${mIndex + 1}.${tIndex + 1}</span>
                                <h3 class="text-white font-bold mb-2 group-hover:text-neon-pink transition-colors">${topic.title}</h3>
                                <p class="text-sm text-gray-500 line-clamp-2">${topic.description}</p>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `).join('');

        } else {
            // Legacy Flat Structure
            const topics = courseData.topics || [];
            if (topics.length > 0) firstTopicId = topics[0].id;

            contentHTML = `
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    ${topics.map((topic, index) => `
                        <div class="bg-dark-surface border border-white/5 rounded-xl p-6 hover:border-neon-pink/50 transition-all cursor-pointer group" 
                             onclick="window.location.hash='#topic/${courseId}/${topic.id}'">
                            <span class="text-neon-pink text-xs font-bold tracking-widest uppercase mb-2 block">Tema ${index + 1}</span>
                            <h3 class="text-white font-bold mb-2 group-hover:text-neon-pink transition-colors">${topic.title}</h3>
                            <p class="text-sm text-gray-500 line-clamp-2">${topic.description}</p>
                        </div>
                    `).join('')}
                </div>
            `;
        }

        const progressData = AppState.courseProgress[courseId] || { progress: 0 };
        const percent = progressData.progress;
        const radius = 40;
        const circumference = 2 * Math.PI * radius;
        const offset = circumference - (percent / 100) * circumference;

        const nextTopic = App.getNextTopic(courseId);

        // Diagnostic Check
        const isDiagnosticPending = !AppState.user?.user_metadata?.diagnostic_completed && percent === 0;

        let startButtonAction = '';
        let startButtonText = '';

        if (isDiagnosticPending) {
            startButtonAction = `window.location.hash='#diagnostic/${courseId}'`;
            startButtonText = 'Comenzar Diagnóstico';
        } else if (nextTopic) {
            startButtonAction = `window.location.hash='#topic/${courseId}/${nextTopic.id}'`;
            startButtonText = `Continuar: ${nextTopic.title}`;
            // If it's the very first topic and progress is 0, maybe "Comenzar Curso"?
            if (percent === 0) startButtonText = 'Comenzar Curso';
        } else {
            // Course Completed
            startButtonAction = `window.location.hash='#courses'`; // Or certificate page
            startButtonText = '¡Curso Completado!';
        }

        container.innerHTML = `
                <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 pt-32">
                    <!-- Header -->
                    <div class="flex justify-between items-end mb-12">
                         <div>
                            <span class="text-neon-pink text-sm font-bold tracking-wider uppercase mb-2 block">Ruta de Aprendizaje</span>
                            <h1 class="text-4xl font-serif text-white mb-2">${courseData.title}</h1>
                            <p class="text-gray-400">Conceptos Fundamentales y Lógica Jurídica</p>
                        </div>
                        <div class="flex gap-4">
                            <button onclick="window.location.hash='courses'" class="text-gray-400 hover:text-white transition-colors">Volver a mis cursos</button>
                        </div>
                    </div>
    
                    <!-- Main Progress -->
                    <div class="bg-dark-card border border-white/10 rounded-3xl p-8 mb-12 relative overflow-hidden group">
                         <div class="absolute top-0 right-0 w-64 h-64 bg-neon-pink/10 blur-[80px] rounded-full group-hover:bg-neon-pink/20 transition-all"></div>
                         
                         <div class="flex flex-col md:flex-row items-center justify-between gap-8 relative z-10">
                            <div class="flex items-center gap-6">
                                <div class="relative w-24 h-24 flex items-center justify-center">
                                    <svg class="w-full h-full transform -rotate-90">
                                        <circle cx="48" cy="48" r="${radius}" stroke="#333" stroke-width="8" fill="none" />
                                        <circle cx="48" cy="48" r="${radius}" stroke="#ff00aa" stroke-width="8" fill="none" 
                                                stroke-dasharray="${circumference}" stroke-dashoffset="${offset}" stroke-linecap="round" class="drop-shadow-[0_0_10px_rgba(255,0,170,0.5)] transition-all duration-1000 ease-out" />
                                    </svg>
                                </div>
                                <div>
                                    <h2 class="text-3xl font-bold text-white mb-1">${percent}% <span class="text-base font-normal text-gray-400">Completado</span></h2>
                                    <p class="text-neon-pink text-sm">
                                        ${percent === 100 ? '¡Felicidades! Has completado el curso.' : nextTopic ? 'Siguiente paso: ' + nextTopic.title : 'Tu viaje ha comenzado.'}
                                    </p>
                                </div>
                            </div>
                            
                            <button onclick="${startButtonAction}" 
                                    class="px-8 py-3 rounded-lg border border-neon-pink/50 text-white hover:bg-neon-pink/10 transition-colors shadow-[0_0_15px_rgba(255,0,170,0.2)]">
                                ${startButtonText}
                            </button>
                         </div>
                    </div>

                    <!-- Course Content -->
                    ${contentHTML}
                </div>
            `;
    },

    renderOnboarding(containerId) {
        const container = document.getElementById(containerId);
        container.innerHTML = ''; // Clean slate

        // State for the quiz
        let currentQuestion = 0;
        let scoreText = 0;
        let scoreVisual = 0;

        const questions = [
            {
                title: "El Nuevo Videojuego",
                text: "Acabas de comprar un videojuego o gadget nuevo que no sabes usar. ¿Qué haces primero?",
                options: [
                    { type: 'text', label: "A", desc: "Leo el manual o el tutorial de texto rápido." },
                    { type: 'visual', label: "B", desc: "Me salto el texto y voy directo a ver los gráficos o diagramas." }
                ]
            },
            {
                title: "Ubicándote en la Ciudad",
                text: "Un amigo te invita a su casa y te manda la ubicación. ¿Cómo te guías mejor?",
                options: [
                    { type: 'text', label: "A", desc: "Por el nombre de las calles e instrucciones escritas." },
                    { type: 'visual', label: "B", desc: "Por puntos de referencia visuales (el Oxxo rojo, el parque azul)." }
                ]
            },
            {
                title: "Estudiando Historia",
                text: "Tienes examen de la Segunda Guerra Mundial mañana. ¿Qué te ayuda más a recordar?",
                options: [
                    { type: 'text', label: "A", desc: "Un resumen escrito con fechas y nombres." },
                    { type: 'visual', label: "B", desc: "Una línea del tiempo con colores y mapas." }
                ]
            },
            {
                title: "Armando un Mueble",
                text: "Llegó un mueble desarmado. Al ver el instructivo, ¿qué buscas?",
                options: [
                    { type: 'text', label: "A", desc: "Los párrafos explicando paso a paso." },
                    { type: 'visual', label: "B", desc: "Los dibujos explosivos de cómo encajan las piezas." }
                ]
            },
            {
                title: "Biología",
                text: "Tienes que aprender las partes del corazón. ¿Qué prefieres?",
                options: [
                    { type: 'text', label: "A", desc: "Una lista con nombres y definiciones." },
                    { type: 'visual', label: "B", desc: "Un dibujo del corazón con etiquetas." }
                ]
            }
        ];

        // Container implementation
        const wrapper = document.createElement('div');
        wrapper.className = "min-h-screen flex items-center justify-center p-4 relative overflow-hidden";

        // Background noise
        wrapper.innerHTML = `
            <div class="absolute inset-0 bg-dark-bg -z-20"></div>
            <div class="absolute top-0 right-0 w-[500px] h-[500px] bg-neon-blue/10 rounded-full blur-[100px] -z-10"></div>
            <div class="absolute bottom-0 left-0 w-[500px] h-[500px] bg-neon-purple/10 rounded-full blur-[100px] -z-10"></div>
            
            <div id="quiz-card" class="w-full max-w-2xl bg-dark-card/80 backdrop-blur-xl border border-white/10 rounded-3xl p-8 md:p-12 shadow-2xl relative animate-fade-in">
                <!-- Content injected here -->
            </div>
        `;
        container.appendChild(wrapper);

        const cardContent = wrapper.querySelector('#quiz-card');

        const renderQuestion = (index) => {
            if (index >= questions.length) {
                renderResult();
                return;
            }

            const q = questions[index];

            // Progress Bar
            const progress = ((index) / questions.length) * 100;

            cardContent.innerHTML = '';
            cardContent.innerHTML = `
                <div class="w-full h-1 bg-white/10 rounded-full mb-8 overflow-hidden">
                    <div class="h-full bg-neon-blue transition-all duration-500 ease-out" style="width: ${progress}%"></div>
                </div>

                <span class="text-neon-blue text-xs font-bold tracking-widest uppercase mb-4 block">Pregunta ${index + 1} de ${questions.length}</span>
                <h2 class="text-3xl font-serif text-white mb-4">${q.title}</h2>
                <p class="text-gray-300 text-lg mb-8 leading-relaxed">${q.text}</p>

                <div class="space-y-4">
                    ${q.options.map(opt => `
                        <button class="w-full text-left group p-4 rounded-xl border border-white/10 hover:border-neon-blue/50 bg-white/5 hover:bg-white/10 transition-all flex items-start gap-4" 
                                onclick="document.dispatchEvent(new CustomEvent('answer-selected', { detail: '${opt.type}' }))">
                            <span class="flex-shrink-0 w-8 h-8 rounded-full bg-white/10 text-white flex items-center justify-center font-bold text-sm group-hover:bg-neon-blue group-hover:text-black transition-colors">
                                ${opt.label}
                            </span>
                            <span class="text-gray-300 group-hover:text-white transition-colors">${opt.desc}</span>
                        </button>
                    `).join('')}
                </div>
            `;
        };

        const renderResult = () => {
            // Determine result logic
            let finalMode = 'visual'; // Default tie breaker
            let modeTitle = 'Visual';

            if (scoreText > scoreVisual) {
                finalMode = 'text';
                modeTitle = 'Texto';
            }

            // Save preference locally immediately so UI might adapt
            AppState.setMode(finalMode);

            cardContent.innerHTML = `
                 <div class="text-center animate-fade-in">
                    <div class="w-20 h-20 mx-auto bg-gradient-to-br from-neon-blue to-neon-purple rounded-full p-[2px] mb-6 shadow-[0_0_30px_rgba(0,243,255,0.4)]">
                        <div class="w-full h-full bg-dark-bg rounded-full flex items-center justify-center">
                            <span class="text-3xl">${finalMode === 'visual' ? '👁️' : '📝'}</span>
                        </div>
                    </div>

                    <h2 class="text-3xl font-serif text-white mb-4">¡Diagnóstico Completado!</h2>
                    <p class="text-gray-300 mb-6 leading-relaxed">
                        Notamos que aprendes mejor con estímulos <strong class="text-white">${finalMode === 'visual' ? 'visuales' : 'de texto'}</strong>. 
                        Hemos configurado PRISMA en <span class="text-neon-blue font-bold">Modo ${modeTitle}</span> para ti.
                    </p>
                    
                    <p class="text-sm text-gray-500 mb-8">
                        No te preocupes, siempre puedes cambiar el modo con el interruptor en cada lección.
                    </p>

                    <button id="finish-onboarding" class="px-8 py-3 bg-white text-black font-bold rounded-xl hover:scale-105 transition-transform shadow-[0_0_20px_rgba(255,255,255,0.3)]">
                        Comenzar a Aprender
                    </button>
                 </div>
            `;

            document.getElementById('finish-onboarding').addEventListener('click', () => {
                AppState.completeOnboarding(finalMode);
            });
        };

        // Event listener for answers (using CustomEvent for cleaner separation)
        document.addEventListener('answer-selected', (e) => {
            const type = e.detail;
            if (type === 'text') scoreText++;
            else scoreVisual++;

            currentQuestion++;
            renderQuestion(currentQuestion);
        }, { once: false }); // Note: This listener will pile up if not careful in SPA, but for this linear flow it's acceptable for now or needs cleanup. 
        // Better: attach onclick directly in renderQuestion to avoid global listener leak, but keeping it simple for "render" pattern.
        // Actually, let's fix the leak by not using document level event, but simple function passing works best here.
        // I'll rewrite renderQuestion buttons to call a local function.

        // RE-Overriding the button onclick logic above to be simpler/safer:
        wrapper.onclick = (e) => {
            const btn = e.target.closest('button');
            if (!btn) return;
            // Check if it's an answer button (has span with class) - simplistic check
            // Let's use data attributes
        };

        // Re-implementing simplified flow without custom events to avoid memory leaks
        const handleAnswer = (type) => {
            if (type === 'text') scoreText++;
            else scoreVisual++;
            currentQuestion++;
            renderQuestion(currentQuestion);
        };

        // Monkey-patching the renderQuestion to use handleAnswer
        const originalRender = renderQuestion;
        // Redefining renderQuestion to include strict onclicks
        const safeRenderQuestion = (index) => {
            if (index >= questions.length) {
                renderResult();
                return;
            }
            const q = questions[index];
            const progress = ((index) / questions.length) * 100;

            cardContent.innerHTML = `
                <div class="w-full h-1 bg-white/10 rounded-full mb-8 overflow-hidden">
                    <div class="h-full bg-neon-blue transition-all duration-500 ease-out" style="width: ${progress}%"></div>
                </div>
                <span class="text-neon-blue text-xs font-bold tracking-widest uppercase mb-4 block">Pregunta ${index + 1} de ${questions.length}</span>
                <h2 class="text-3xl font-serif text-white mb-4 animate-fade-in">${q.title}</h2>
                <p class="text-gray-300 text-lg mb-8 leading-relaxed animate-fade-in">${q.text}</p>
                <div class="space-y-4 animate-fade-in">
                    <!-- Buttons injected below -->
                    <div id="options-container"></div>
                </div>
            `;

            const optsContainer = cardContent.querySelector('#options-container');
            q.options.forEach(opt => {
                const btn = document.createElement('button');
                btn.className = "w-full text-left group p-4 rounded-xl border border-white/10 hover:border-neon-blue/50 bg-white/5 hover:bg-white/10 transition-all flex items-start gap-4 mb-3";
                btn.innerHTML = `
                    <span class="flex-shrink-0 w-8 h-8 rounded-full bg-white/10 text-white flex items-center justify-center font-bold text-sm group-hover:bg-neon-blue group-hover:text-black transition-colors">${opt.label}</span>
                    <span class="text-gray-300 group-hover:text-white transition-colors">${opt.desc}</span>
                `;
                btn.onclick = () => handleAnswer(opt.type);
                optsContainer.appendChild(btn);
            });
        };

        // Start
        safeRenderQuestion(0);
    },

    renderProfile(containerId) {
        const container = document.getElementById(containerId);
        if (!AppState.user) {
            window.location.hash = '#home';
            return;
        }

        const user = AppState.user;

        container.innerHTML = `
            <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 pt-32 animate-fade-in">
                <div class="mb-12">
                     <span class="text-neon-blue text-sm font-bold tracking-wider uppercase mb-2 block">Mi Cuenta</span>
                     <h1 class="text-4xl font-serif text-white mb-2">Perfil del Estudiante</h1>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
                     <!-- Profile Card (Editable) -->
                     <div class="md:col-span-1">
                        <div class="bg-dark-card border border-white/10 rounded-2xl p-8 flex flex-col items-center text-center relative overflow-hidden">
                             <div class="absolute inset-0 bg-gradient-to-b from-transparent to-neon-blue/5 pointer-events-none"></div>
                             
                             <div class="mb-6 relative group">
                                 <div class="w-32 h-32 rounded-full p-1 bg-gradient-to-br from-neon-blue to-neon-purple shadow-[0_0_20px_rgba(0,243,255,0.3)]">
                                    <div class="w-full h-full rounded-full bg-dark-bg overflow-hidden relative">
                                        <img src="${user.avatar}" alt="${user.name}" class="w-full h-full object-cover">
                                    </div>
                                 </div>
                             </div>

                             <!-- Avatar Selection for Edit -->
                             <div class="w-full space-y-4 mb-6">
                                <p class="text-xs text-gray-500 uppercase font-bold">Cambiar Avatar</p>
                                <div class="flex justify-center gap-2">

                                    <button onclick="AppState.updateUserAvatar('https://api.dicebear.com/9.x/avataaars/svg?seed=Nala&backgroundColor=202020')" 
                                            class="w-8 h-8 rounded-full border border-white/20 hover:border-neon-blue hover:scale-110 transition-all overflow-hidden" title="Opción 1">
                                        <img src="https://api.dicebear.com/9.x/avataaars/svg?seed=Nala&backgroundColor=202020" class="w-full h-full">
                                    </button>
                                    <button onclick="AppState.updateUserAvatar('https://api.dicebear.com/9.x/avataaars/svg?seed=Felix&backgroundColor=202020')" 
                                            class="w-8 h-8 rounded-full border border-white/20 hover:border-neon-blue hover:scale-110 transition-all overflow-hidden" title="Opción 2">
                                        <img src="https://api.dicebear.com/9.x/avataaars/svg?seed=Felix&backgroundColor=202020" class="w-full h-full">
                                    </button>
                                </div>
                             </div>
                             
                             <h2 class="text-2xl font-bold text-white mb-1">${this.escapeHTML(user.name)}</h2>
                             <span class="px-3 py-1 rounded-full bg-neon-blue/10 text-neon-blue text-xs font-bold uppercase tracking-wider mb-6">Estudiante Activo</span>
                             
                             <div class="w-full border-t border-white/10 pt-6 mt-2">
                                <div class="flex justify-between text-sm text-gray-400 mb-2">
                                    <span>Miembro desde</span>
                                    <span class="text-white">Diciembre 2025</span>
                                </div>
                             </div>
                        </div>
                     </div>

                     <!-- Details Form -->
                     <div class="md:col-span-2">
                        <div class="bg-dark-surface border border-white/5 rounded-2xl p-8">
                            <h3 class="text-xl font-bold text-white mb-6 flex items-center gap-2">
                                <svg class="w-5 h-5 text-neon-pink" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
                                Información Personal
                            </h3>
                            
                            <div class="space-y-6">
                                <div>
                                    <label class="block text-xs uppercase tracking-wider text-gray-500 font-bold mb-2">Nombre Completo</label>
                                    <input type="text" value="${this.escapeHTML(user.name)}" readonly  class="w-full bg-dark-bg/50 border border-white/10 rounded-xl px-4 py-3 text-gray-300 focus:outline-none cursor-not-allowed">
                                </div>
                                
                                <div>
                                    <label class="block text-xs uppercase tracking-wider text-gray-500 font-bold mb-2">Correo Electrónico</label>
                                    <input type="text" value="${this.escapeHTML(user.email || 'No disponible')}" readonly class="w-full bg-dark-bg/50 border border-white/10 rounded-xl px-4 py-3 text-gray-300 focus:outline-none cursor-not-allowed">
                                </div>
                            </div>
                        </div>
                     </div>
                </div>
            </div>
        `;
    },

    // --- Diagnostic Exam Logic ---
    renderDiagnostic(courseId, containerId) {
        const container = document.getElementById(containerId);
        container.innerHTML = '';

        // 1. Check Data
        if (!window.DIAGNOSTIC_DATA || !window.DIAGNOSTIC_DATA[courseId]) {
            container.innerHTML = '<h1 class="text-white text-center mt-20">Diagnóstico no disponible</h1>';
            return;
        }

        const questions = window.DIAGNOSTIC_DATA[courseId];
        let currentIdx = 0;
        let score = 0;

        // wrapper
        const wrapper = document.createElement('div');
        wrapper.className = "min-h-screen flex items-center justify-center p-4";
        container.appendChild(wrapper);

        // Render Question Function
        const showQuestion = (idx) => {
            if (idx >= questions.length) {
                showResults();
                return;
            }

            const q = questions[idx];
            const progress = ((idx) / questions.length) * 100;

            wrapper.innerHTML = `
                <div class="max-w-2xl w-full bg-dark-card border border-white/10 rounded-3xl p-8 md:p-12 shadow-2xl relative overflow-hidden animate-fade-in">
                     <!-- Ambient Background -->
                     <div class="absolute top-0 right-0 w-64 h-64 bg-neon-cyan/5 blur-[60px] rounded-full pointer-events-none"></div>
                     
                     <!-- Header -->
                     <div class="flex justify-between items-center mb-8 relative z-10">
                        <div>
                             <span class="text-neon-cyan text-xs font-bold tracking-widest uppercase mb-1 block">Evaluación Inicial</span>
                             <h2 class="text-2xl font-bold text-white">Descubre tu Nivel</h2>
                        </div>
                        <div class="text-right">
                             <span class="text-3xl font-bold text-white/20">${idx + 1}<span class="text-base">/${questions.length}</span></span>
                        </div>
                     </div>

                     <!-- Question -->
                     <p class="text-xl text-gray-200 mb-8 leading-relaxed font-medium">${q.question}</p>

                     <!-- Options -->
                     <div class="space-y-3 relative z-10" id="diag-options">
                        ${q.options.map((opt, i) => `
                            <button class="w-full text-left p-4 rounded-xl border border-white/10 hover:border-neon-cyan/50 bg-white/5 hover:bg-white/10 transition-all flex items-center gap-4 group"
                                    data-idx="${i}">
                                <span class="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-sm font-bold text-gray-400 group-hover:bg-neon-cyan group-hover:text-black transition-colors">${String.fromCharCode(65 + i)}</span>
                                <span class="text-gray-300 group-hover:text-white">${opt}</span>
                            </button>
                        `).join('')}
                     </div>

                     <!-- Progress Bar -->
                     <div class="absolute bottom-0 left-0 w-full h-1 bg-white/5">
                        <div class="h-full bg-neon-cyan transition-all duration-300" style="width: ${progress}%"></div>
                     </div>
                </div>
            `;

            // Attach listeners
            const btns = wrapper.querySelectorAll('#diag-options button');
            btns.forEach(btn => {
                btn.onclick = () => {
                    const selected = parseInt(btn.dataset.idx);
                    if (selected === q.correct) score++;
                    currentIdx++;
                    showQuestion(currentIdx);
                };
            });
        };

        // Render Results Function
        const showResults = () => {
            const finalScore = (score / questions.length) * 10.0; // 0 to 10 scale
            let level = "Principiante";
            let msg = "¡Es un gran comienzo!";
            if (finalScore >= 8) { level = "Avanzado"; msg = "¡Tienes excelentes bases!"; }
            else if (finalScore >= 5) { level = "Intermedio"; msg = "¡Vas por buen camino!"; }

            // Mark as complete and set initial progress
            if (AppState.user) {
                // Save diagnostic completion locally and remotely if needed.
                // We'll update metadata.
                const metadata = AppState.user.user_metadata || {};
                if (!metadata.diagnostic_completed) {
                    metadata.diagnostic_completed = true;
                    // We also want to set course progress to 5% if it's 0.
                    // But strictly speaking, the user hasn't completed a TOPIC.
                    // The requirement said "5% Completed" on dashboard after diagnostic.
                    // We can hack this by updating courseStatus directly.

                    // Upsert metadata via Supabase
                    if (typeof supabaseClient !== 'undefined') {
                        supabaseClient.auth.updateUser({ data: { diagnostic_completed: true } });
                    }
                    // Update local user
                    AppState.user.user_metadata = metadata;

                    // Set initial progress
                    AppState.updateCourseStatus(courseId, { progress: 5, started: true });
                }
            }

            // Render Success Screen
            wrapper.innerHTML = `
                 <div class="max-w-2xl w-full text-center animate-fade-in relative z-10">
                    <div class="mb-8 relative inline-block">
                         <div class="absolute inset-0 bg-neon-cyan/20 blur-xl rounded-full"></div>
                         <div class="relative w-32 h-32 bg-dark-card border border-neon-cyan/50 rounded-full flex items-center justify-center mx-auto">
                            <span class="text-5xl">🚀</span>
                         </div>
                    </div>

                    <h2 class="text-4xl font-bold text-white mb-2">¡Diagnóstico Completado!</h2>
                    <p class="text-xl text-gray-400 mb-8">${msg}</p>

                    <div class="grid grid-cols-2 gap-4 max-w-md mx-auto mb-10">
                        <div class="bg-white/5 rounded-xl p-4 border border-white/5">
                            <span class="block text-xs text-gray-500 uppercase font-bold mb-1">Aciertos</span>
                            <span class="text-2xl font-bold text-white">${score}/${questions.length}</span>
                        </div>
                        <div class="bg-white/5 rounded-xl p-4 border border-white/5">
                            <span class="block text-xs text-gray-500 uppercase font-bold mb-1">Nivel Inicial</span>
                            <span class="text-2xl font-bold text-neon-cyan">${level}</span>
                        </div>
                    </div>

                    <button onclick="window.location.hash='#courses'" 
                            class="px-10 py-4 bg-gradient-to-r from-neon-cyan to-neon-blue text-black font-bold rounded-xl hover:scale-105 transition-transform shadow-[0_0_20px_rgba(0,243,255,0.4)]">
                        Ir al Dashboard del Curso
                    </button>
                 </div>
             `;
        };

        // Start Interaction
        // Intro Screen
        wrapper.innerHTML = `
             <div class="max-w-xl w-full text-center animate-fade-in">
                <h1 class="text-4xl font-serif text-white mb-6">Evaluación Diagnóstica</h1>
                <p class="text-gray-300 text-lg mb-8 leading-relaxed">
                    Antes de comenzar, queremos conocer qué tanto sabes sobre el Derecho.
                    No te preocupes por la calificación, esto nos ayuda a personalizar tu experiencia.
                </p>
                <button id="start-diag-btn" class="px-8 py-3 bg-neon-cyan text-black font-bold rounded-full hover:bg-white transition-colors">
                    Comenzar Evaluación
                </button>
             </div>
        `;

        wrapper.querySelector('#start-diag-btn').onclick = () => showQuestion(0);
    },

    renderSettings(containerId) {
        const container = document.getElementById(containerId);

        container.innerHTML = `
            <div class="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 pt-32 animate-fade-in">
                <div class="mb-12 text-center">
                     <span class="text-gray-500 text-sm font-bold tracking-wider uppercase mb-2 block">Preferencias</span>
                     <h1 class="text-4xl font-serif text-white mb-4">Configuración</h1>
                     <p class="text-gray-400">Personaliza tu experiencia en PRISMA.</p>
                </div>

                <div class="space-y-6">
                    <!-- Section: Interface -->
                    <div class="bg-dark-card border border-white/10 rounded-2xl p-6 md:p-8">
                        <h3 class="text-xl font-bold text-white mb-6">Interfaz</h3>
                        
                        <div class="flex items-center justify-between py-4 border-b border-white/5">
                            <div>
                                <h4 class="text-white font-medium">Modo Oscuro</h4>
                                <p class="text-sm text-gray-500">PRISMA está diseñado en modo oscuro por defecto.</p>
                            </div>
                            <div class="relative inline-block w-12 h-6 transition duration-200 ease-in-out">
                                <input type="checkbox" checked disabled class="opacity-0 w-0 h-0">
                                <span class="absolute cursor-pointer top-0 left-0 right-0 bottom-0 bg-neon-blue rounded-full transition-all duration-300 opacity-50"></span>
                                <span class="absolute left-1 bottom-1 bg-white w-4 h-4 rounded-full transition-all duration-300 transform translate-x-6"></span>
                            </div>
                        </div>

                         <div class="flex items-center justify-between py-4">
                            <div>
                                <h4 class="text-white font-medium">Animaciones</h4>
                                <p class="text-sm text-gray-500">Activar efectos visuales y transiciones suaves.</p>
                            </div>
                             <button class="w-12 h-6 bg-neon-blue rounded-full relative transition-colors duration-300">
                                <span class="absolute right-1 top-1 bg-white w-4 h-4 rounded-full shadow-md"></span>
                            </button>
                        </div>
                    </div>

                    <!-- Section: Notifications -->
                    <div class="bg-dark-card border border-white/10 rounded-2xl p-6 md:p-8">
                        <h3 class="text-xl font-bold text-white mb-6">Notificaciones</h3>
                        
                        <div class="flex items-center justify-between py-4 border-b border-white/5">
                            <div>
                                <h4 class="text-white font-medium">Recordatorios de Estudio</h4>
                                <p class="text-sm text-gray-500">Recibe alertas para mantener tu racha.</p>
                            </div>
                             <button class="w-12 h-6 bg-gray-700 rounded-full relative transition-colors duration-300">
                                <span class="absolute left-1 top-1 bg-white w-4 h-4 rounded-full shadow-md"></span>
                            </button>
                        </div>

                         <div class="flex items-center justify-between py-4">
                            <div>
                                <h4 class="text-white font-medium">Correos de Progreso</h4>
                                <p class="text-sm text-gray-500">Resumen semanal de tu avance.</p>
                            </div>
                             <button class="w-12 h-6 bg-neon-blue rounded-full relative transition-colors duration-300">
                                <span class="absolute right-1 top-1 bg-white w-4 h-4 rounded-full shadow-md"></span>
                            </button>
                        </div>
                    </div>

                    <!-- Section: Danger Zone -->
                    <div class="bg-dark-card border border-red-500/20 rounded-2xl p-6 md:p-8">
                        <h3 class="text-xl font-bold text-red-400 mb-6">Zona de Peligro</h3>
                         <div class="flex items-center justify-between">
                            <div>
                                <h4 class="text-white font-medium">Cerrar Sesión Global</h4>
                                <p class="text-sm text-gray-500">Salir de todos los dispositivos.</p>
                            </div>
                             <button onclick="AppState.logout()" class="px-4 py-2 border border-red-500/30 text-red-400 rounded-lg hover:bg-red-500/10 transition-colors text-sm font-bold">
                                Cerrar Sesión
                            </button>
                        </div>
                    </div>

                </div>
            </div>
        `;
    },

    renderSearchResults(containerId, query) {
        const container = document.getElementById(containerId);
        const safeQuery = this.escapeHTML(query);
        const q = safeQuery.toLowerCase();

        let results = [];
        if (App.searchIndex && App.searchIndex.length > 0) {
            results = App.searchIndex.filter(item =>
                item.title.toLowerCase().includes(q) || (item.subtitle && item.subtitle.toLowerCase().includes(q))
            );
        }

        const count = results.length;
        let resultsHTML = '';

        if (count > 0) {
            resultsHTML = results.map(c => `
                <div class="bg-dark-card border border-white/10 rounded-2xl p-6 flex flex-col hover:bg-white/5 transition-colors cursor-pointer group" 
                     onclick="App.navigateToSuggestion('${c.type}', '${c.id}', '${c.subject || ''}')">
                    <div class="w-12 h-12 mb-4 ${c.color} group-hover:scale-110 transition-transform duration-300">
                        <svg viewBox="0 0 24 24" fill="none" class="w-full h-full" stroke="currentColor" stroke-width="1.5">
                            <path stroke-linecap="round" stroke-linejoin="round" d="${c.icon}" />
                        </svg>
                    </div>
                    <h3 class="text-xl font-bold text-white mb-2">${c.title}</h3>
                    <p class="text-gray-400 text-sm">${c.subtitle}</p>
                </div>
            `).join('');
        } else {
            resultsHTML = `
                <div class="col-span-1 md:col-span-2 lg:col-span-3 text-center py-12">
                     <p class="text-gray-500 text-lg mb-4">No encontramos resultados para "${safeQuery}"</p>
                     <button onclick="window.location.hash='#courses'" class="text-neon-blue hover:text-white transition-colors underline">Ver todos los cursos</button>
                </div>
             `;
        }

        container.innerHTML = `
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 pt-32">
                <div class="mb-12">
                    <span class="text-neon-blue text-sm font-bold tracking-wider uppercase mb-2 block">Búsqueda</span>
                    <h1 class="text-4xl font-serif text-white mb-2">Resultados para: <span class="text-gray-400 italic">"${safeQuery}"</span></h1>
                    <p class="text-gray-500">${count} resultado(s) encontrados</p>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    ${resultsHTML}
                </div>
            </div>
        `;
    },

    // --- Lightbox Logic ---
    openLightbox(src, type = 'image') {
        const lightbox = document.createElement('div');
        lightbox.id = 'prisma-lightbox';
        lightbox.className = 'fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in opacity-0';
        lightbox.onclick = (e) => {
            if (e.target === lightbox) Renderers.closeLightbox();
        };

        const content = type === 'image'
            ? `<img src="${src}" class="max-w-full max-h-[90vh] rounded-xl shadow-[0_0_50px_rgba(0,0,0,0.8)] transform scale-95 transition-transform duration-300">`
            : `<video src="${src}" controls autoplay class="max-w-full max-h-[90vh] rounded-xl shadow-2xl"></video>`;

        lightbox.innerHTML = `
            <div class="relative w-full max-w-6xl mx-auto flex items-center justify-center">
                 <button onclick="Renderers.closeLightbox()" class="absolute -top-12 right-0 text-white/50 hover:text-white transition-colors">
                    <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                 </button>
                 ${content}
            </div>
        `;

        document.body.appendChild(lightbox);

        // Trigger animation
        requestAnimationFrame(() => {
            lightbox.classList.remove('opacity-0');
            const media = lightbox.querySelector('img, video');
            if (media) media.classList.remove('scale-95');
        });

        // Disable scroll
        document.body.style.overflow = 'hidden';
    },

    closeLightbox() {
        const lightbox = document.getElementById('prisma-lightbox');
        if (lightbox) {
            lightbox.classList.add('opacity-0');
            setTimeout(() => {
                lightbox.remove();
                document.body.style.overflow = '';
            }, 300);
        }
    },

    handleVisualClick(e) {
        // Handle direct image clicks or clicks on overlays (common in our design)
        // We look for an image within the clicked container or the clicked element itself
        const target = e.target;

        let img = null;
        if (target.tagName.toLowerCase() === 'img') {
            img = target;
        } else {
            // Check if we clicked an overlay that covers an image
            const wrapper = target.closest('.relative');
            if (wrapper) {
                img = wrapper.querySelector('img');
            }
        }

        if (img) {
            e.preventDefault();
            e.stopPropagation();
            this.openLightbox(img.src, 'image');
        }
    }
};

// Simple Fade In CSS class via style tag for JS-injected content
const style = document.createElement('style');
style.textContent = `
    @keyframes fadeIn {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
    }
    .animate-fade-in {
        animation: fadeIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        opacity: 0; 
    }
    .animate-float {
        animation: float 6s ease-in-out infinite;
    }
    @keyframes float {
        0%, 100% { transform: translateY(0px); }
        50% { transform: translateY(-10px); }
    }
    .cursor-zoom-in {
        cursor: zoom-in;
    }
`;
document.head.appendChild(style);