// Configuración de Supabase
// IMPORTANTE: REEMPLAZA ESTAS VARIABLES CON TUS DATOS DE SUPABASE
const SUPABASE_URL = 'https://uxivnsnvdtmtiwrwvyyc.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV4aXZuc252ZHRtdGl3cnd2eXljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU3NzEyODAsImV4cCI6MjA4MTM0NzI4MH0.nBwOvnIV8dfJzCsqi0u9CrU1PLMr2mo3Ih5W33hcgPs';

// Inicializar cliente
const supabaseClient = typeof supabase !== 'undefined' ? supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;

const AppState = {
    currentMode: 'visual', // 'visual' or 'text'
    currentTopic: null,

    // Auth State
    isLoggedIn: false,
    user: null,

    // Course Progress Management (Defaults should be 0/false for everything)
    courseProgress: {
        derecho: {
            started: false,
            progress: 0
        },
        comipems: {
            started: false, // Defaulted to false for new users
            progress: 0
        }
    },

    // Subscribers for reactivity
    listeners: [],

    // Auto-Logout Configuration
    idleTimer: null,
    IDLE_TIMEOUT: 30 * 60 * 1000, // 30 minutes in milliseconds

    startIdleTimer() {
        // Clear existing if any
        if (this.idleTimer) clearTimeout(this.idleTimer);

        // Setup reset listeners if not already done (naive check, but safe for singleton)
        // We'll attach them to window
        const events = ['mousemove', 'keypress', 'click', 'scroll', 'touchstart'];

        const reset = () => this.resetIdleTimer();

        // Avoid attaching multiple times by checking a flag or just removing first
        // Simple approach: remove then add
        events.forEach(event => {
            window.removeEventListener(event, reset);
            window.addEventListener(event, reset);
        });

        // Start counting
        this.resetIdleTimer();
    },

    resetIdleTimer() {
        if (!this.isLoggedIn) return; // Don't run if not logged in

        if (this.idleTimer) clearTimeout(this.idleTimer);

        this.idleTimer = setTimeout(() => {
            console.log("User idle for too long. Logging out...");
            this.logout();
            alert("Tu sesión se ha cerrado por inactividad.");
        }, this.IDLE_TIMEOUT);
    },

    stopIdleTimer() {
        if (this.idleTimer) clearTimeout(this.idleTimer);
        this.idleTimer = null;
    },

    init() {
        if (!supabaseClient) {
            console.error('Supabase SDK no está cargado o configurado.');
            return;
        }
        this.checkSession();

        // Escuchar cambios de autenticación en tiempo real
        supabaseClient.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN') {
                this.isLoggedIn = true;
                this.user = session.user;
                this.user.avatar = session.user.user_metadata.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${session.user.email}`;
                this.user.name = session.user.user_metadata.full_name || session.user.email.split('@')[0];
                this.loadProgress();
                this.startIdleTimer(); // Start monitoring
            } else if (event === 'SIGNED_OUT') {
                this.isLoggedIn = false;
                this.user = null;
                this.stopIdleTimer(); // Stop monitoring
                // Reset to clean defaults
                this.courseProgress = { derecho: { started: false, progress: 0 }, comipems: { started: false, progress: 0 } };
                window.location.hash = '#home'; // Redirect home
            }
            this.notify();
        });
    },

    async checkSession() {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (session) {
            this.isLoggedIn = true;
            this.user = session.user;
            // Mapeo de metadata para compatibilidad con UI existente
            this.user.avatar = session.user.user_metadata.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${session.user.email}`;
            this.user.name = session.user.user_metadata.full_name || session.user.email.split('@')[0];

            // Onboarding Check
            const onboardingCompleted = session.user.user_metadata.onboarding_completed;
            const currentHash = window.location.hash;

            await this.loadProgress();
            // Force recalculation to account for new curriculum content
            await this.recalculateProgress('derecho');
            this.startIdleTimer(); // Start monitoring

            // Logic: If logged in & !onboarding_completed -> Goto #onboarding
            // If logged in & onboarding_completed & (home or onboarding) -> Goto #courses

            if (!onboardingCompleted && currentHash !== '#onboarding') {
                window.location.hash = '#onboarding';
            } else if (onboardingCompleted && (currentHash === '' || currentHash === '#home' || currentHash === '#onboarding')) {
                window.location.hash = '#courses';
            }

        } else {
            this.isLoggedIn = false;
            this.user = null;
            this.stopIdleTimer();
        }
        this.notify();
    },

    async completeOnboarding(preferredMode) {
        if (!this.user) return;

        try {
            const { data, error } = await supabaseClient.auth.updateUser({
                data: {
                    onboarding_completed: true,
                    preferred_mode: preferredMode
                }
            });

            if (error) {
                console.error("Error completing onboarding:", error);
                throw error;
            }

            // Update local state immediately
            this.user.user_metadata = { ...this.user.user_metadata, onboarding_completed: true, preferred_mode: preferredMode };

            // Sets the app mode preference
            this.setMode(preferredMode);

            // Redirect
            window.location.hash = '#courses';
        } catch (err) {
            console.error("Critical Onboarding Error:", err);
            throw err;
        }
    },

    async login(email, password) {
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email,
            password
        });

        if (error) {
            throw error; // Re-throw to be caught by UI
        }
        return true;
    },

    async signUp(email, password, fullName, avatarUrl) {
        const { data, error } = await supabaseClient.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name: fullName,
                    avatar_url: avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${email}`
                }
            }
        });

        if (error) {
            throw error;
        }



        return true;
    },

    async updateUserAvatar(avatarUrl) {
        if (!this.user) return false;

        const { data, error } = await supabaseClient.auth.updateUser({
            data: { avatar_url: avatarUrl }
        });

        if (error) {
            console.error('Error updating avatar:', error);
            throw error;
        }

        // Update local state
        this.user.avatar = avatarUrl;
        // Refresh session data ensures we are in sync
        await this.checkSession();
        return true;
    },

    async logout() {
        this.stopIdleTimer(); // Ensure timer is killed
        const { error } = await supabaseClient.auth.signOut();
        if (error) console.error('Error logout:', error);
    },

    async updateCourseStatus(courseId, statusUpdates) {
        // 1. Actualización Optimista (Local)
        if (!this.courseProgress[courseId]) {
            this.courseProgress[courseId] = { started: false, progress: 0 };
        }
        Object.assign(this.courseProgress[courseId], statusUpdates);
        this.notify();

        // 2. Persistencia en Supabase
        if (this.isLoggedIn && this.user) {
            try {
                // Preparamos datos para la tabla user_courses
                const updateData = {
                    user_id: this.user.id,
                    course_id: courseId,
                    progress: this.courseProgress[courseId].progress,
                    // Si started es true, asegurarnos de que started_at tenga valor. Si no, ponerle now()
                    started_at: this.courseProgress[courseId].started ? (this.courseProgress[courseId].started_at || new Date()) : null,
                    last_accessed: new Date()
                };

                // Upsert: Insertar o Actualizar si existe (requiere unique constraint en user_id, course_id en DB)
                const { error } = await supabaseClient
                    .from('user_courses')
                    .upsert(updateData, { onConflict: 'user_id, course_id' });

                if (error) throw error;

            } catch (err) {
                console.error('Error guardando progreso:', err.message);
                // Alertar al usuario si falla la sincronización crítica
                if (err.message.includes('new row violates row-level security policy') || err.code === '42501') {
                    alert("Error de Seguridad: No tienes permisos para guardar este progreso. Asegúrate de haber iniciado sesión correctamente.");
                } else {
                    // Silent fail for network glitches, but log it
                    console.warn("No se pudo sincronizar el progreso con la nube.");
                }
            }
        }
    },

    async markTopicCompleted(subject, topicId) {
        if (!this.isLoggedIn || !this.user) return;

        try {
            // 1. Get current completed list strictly from latest metadata
            let completed = this.user.user_metadata.completed_topics || [];

            // 2. Check Uniqueness
            if (completed.includes(topicId)) {
                console.log(`Topic ${topicId} already completed. No progress increase.`);
                return; // Already counted
            }

            // 3. Add to list and Update Metadata
            completed.push(topicId);

            const { data, error } = await supabaseClient.auth.updateUser({
                data: { completed_topics: completed }
            });

            if (error) throw error;

            // Update local user immediately
            this.user.user_metadata.completed_topics = completed;

            // 4. Calculate New Progress
            const course = window.CURRICULUM_DATA[subject];
            let totalTopics = 0;
            if (course) {
                if (course.modules) {
                    course.modules.forEach(m => totalTopics += m.topics.length);
                } else if (course.topics) {
                    totalTopics = course.topics.length;
                }
            }

            if (totalTopics > 0) {
                // Determine how many of the "completed" belong to this subject logic? 
                // For simplicity assuming global uniqueness or subject prefix in IDs. 
                // The current IDs are 'topic-1-1' etc. If courses share IDs we have an issue.
                // Assuming IDs are unique per course or global.
                // Better safety checks: filter completed by those actually in the course?
                // For now, simple count of unique IDs is fine if IDs are unique.

                // Let's filter to be safe: count how many of 'completed' are in this course structure
                let subjectCompletedCount = 0;
                // Helper to check existence
                const isTopicInCourse = (tid) => {
                    if (course.modules) {
                        return course.modules.some(m => m.topics.some(t => t.id === tid));
                    }
                    return course.topics ? course.topics.some(t => t.id === tid) : false;
                };

                completed.forEach(tid => {
                    if (isTopicInCourse(tid)) subjectCompletedCount++;
                });

                const newProgress = Math.min(100, Math.round((subjectCompletedCount / totalTopics) * 100));

                console.log(`Progress Update: ${subjectCompletedCount}/${totalTopics} = ${newProgress}%`);

                // 5. Save Course Progress
                await this.updateCourseStatus(subject, {
                    progress: newProgress,
                    started: true
                });
            }

        } catch (err) {
            console.error("Error marking topic complete:", err);
        }
    },

    async loadProgress() {
        if (!this.isLoggedIn || !this.user) return;

        try {
            const { data, error } = await supabaseClient
                .from('user_courses')
                .select('course_id, progress, started_at');

            if (error) throw error;

            if (data && data.length > 0) {
                // Fusionar datos de la nube con el estado local
                data.forEach(item => {
                    this.courseProgress[item.course_id] = {
                        started: true, // Si existe fila, está iniciado
                        progress: item.progress,
                        started_at: item.started_at
                    };
                });
            } else {
                // No hay datos, asegurarse de que todo esté en 0 (ya lo hace el default, pero refuerzo)
                this.courseProgress = {
                    derecho: { started: false, progress: 0 },
                    comipems: { started: false, progress: 0 }
                };
            }
            this.notify();
        } catch (err) {
            console.error('Error cargando progreso:', err.message);
        }
    },

    subscribe(callback) {
        this.listeners.push(callback);
    },

    notify() {
        this.listeners.forEach(cb => cb(this));
    },

    setMode(mode) {
        if (this.currentMode !== mode) {
            this.currentMode = mode;
            this.notify();
        }
    },

    setTopic(topic) {
        this.currentTopic = topic;
        this.notify();
    },

    async recalculateProgress(subject) {
        if (!this.isLoggedIn || !this.user) {
            console.log("Cannot recalculate: User not logged in");
            return;
        }

        console.log(`Recalculating progress for ${subject}...`);

        const course = window.CURRICULUM_DATA[subject];
        if (!course) {
            console.error("Course not found:", subject);
            return;
        }

        let totalTopics = 0;
        if (course.modules) {
            course.modules.forEach(m => totalTopics += m.topics.length);
        } else if (course.topics) {
            totalTopics = course.topics.length;
        }

        if (totalTopics === 0) return;

        let completed = this.user.user_metadata.completed_topics || [];

        // Count valid completed topics for this subject
        let subjectCompletedCount = 0;
        const isTopicInCourse = (tid) => {
            if (course.modules) {
                return course.modules.some(m => m.topics.some(t => t.id === tid));
            }
            return course.topics ? course.topics.some(t => t.id === tid) : false;
        };

        completed.forEach(tid => {
            if (isTopicInCourse(tid)) subjectCompletedCount++;
        });

        const newProgress = Math.min(100, Math.round((subjectCompletedCount / totalTopics) * 100));
        console.log(`Recalculation Result: ${subjectCompletedCount}/${totalTopics} = ${newProgress}%`);

        // Save and Notify
        await this.updateCourseStatus(subject, {
            progress: newProgress,
            started: subjectCompletedCount > 0
        });

        return newProgress;
    }
};

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    AppState.init();
});
