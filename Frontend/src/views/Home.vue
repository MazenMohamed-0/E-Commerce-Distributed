<template>
  <v-app>
    <NavBar :showBackButton="false" />
    
    <v-main :class="{ 'bg-dark': isDark }">
      <!-- Hero Section -->
      <section class="hero-section">
        <v-container class="py-16">
          <v-row align="center" justify="center">
            <v-col cols="12" md="6" class="text-center text-md-left hero-content">
              <v-slide-y-transition>
                <h1 class="text-h2 font-weight-bold mb-4 animate-in" :class="isDark ? 'text-white' : ''">
                  Welcome to Solid E-Commerce
                </h1>
              </v-slide-y-transition>
              
              <v-slide-y-transition>
                <p class="text-h6 mb-8 animate-in-delay-1" :class="isDark ? 'text-medium-emphasis' : 'text-secondary'">
                  Anything you want in Solid Store.
                </p>
              </v-slide-y-transition>

              <v-slide-y-transition>
                <div class="d-flex flex-column flex-sm-row gap-4 justify-center justify-md-start animate-in-delay-2">
                  <v-btn
                    color="primary"
                    size="x-large"
                    to="/signup"
                    class="px-8 action-btn"
                    elevation="2"
                  >
                    Get Started
                  </v-btn>
                  <v-btn
                    variant="outlined"
                    size="x-large"
                    to="/login"
                    class="px-8 action-btn"
                  >
                    Sign In
                  </v-btn>
                </div>
              </v-slide-y-transition>
            </v-col>
            <v-col cols="12" md="6" class="d-none d-md-flex justify-center">
              <v-slide-x-transition>
                <v-img
                  src="@/public/images/Solid.jpg"
                  max-width="500"
                  class="rounded-lg hero-image animate-in-delay-3"
                ></v-img>
              </v-slide-x-transition>
            </v-col>
          </v-row>
        </v-container>
      </section>

      <!-- Features Section -->
      <section class="features-section py-16" :class="isDark ? 'bg-dark-lighter' : 'bg-grey-lighten-4'">
        <v-container>
          <v-slide-y-transition>
            <h2 class="text-h3 font-weight-bold text-center mb-12 animate-in" :class="isDark ? 'text-white' : ''">
              Why Choose Us
            </h2>
          </v-slide-y-transition>

          <v-row>
            <v-col cols="12" md="4" v-for="(feature, index) in features" :key="feature.title">
              <v-slide-y-transition>
                <v-card
                  class="feature-card pa-6 h-100"
                  :theme="isDark ? 'dark' : 'light'"
                  :elevation="isDark ? 4 : 1"
                  :style="{ animationDelay: `${index * 200}ms` }"
                >
                  <v-icon
                    :icon="feature.icon"
                    color="primary"
                    size="48"
                    class="mb-4 feature-icon"
                  ></v-icon>
                  <h3 class="text-h5 font-weight-bold mb-4">{{ feature.title }}</h3>
                  <p :class="isDark ? 'text-medium-emphasis' : 'text-secondary'">
                    {{ feature.description }}
                  </p>
                </v-card>
              </v-slide-y-transition>
            </v-col>
          </v-row>
        </v-container>
      </section>

      <!-- Call to Action Section -->
      <section class="cta-section py-16">
        <v-container>
          <v-row justify="center">
            <v-col cols="12" md="8" class="text-center">
              <v-slide-y-transition>
                <h2 class="text-h3 font-weight-bold mb-6 animate-in" :class="isDark ? 'text-white' : ''">
                  Ready to Get Started?
                </h2>
              </v-slide-y-transition>

              <v-slide-y-transition>
                <p class="text-h6 mb-8 animate-in-delay-1" :class="isDark ? 'text-medium-emphasis' : 'text-secondary'">
                  Create your account in seconds and explore everything Solid has to offer..
                </p>
              </v-slide-y-transition>

              <v-slide-y-transition>
                <v-btn
                  color="primary"
                  size="x-large"
                  to="/signup"
                  class="px-8 action-btn animate-in-delay-2"
                  elevation="2"
                >
                  Start Your Free Trial
                </v-btn>
              </v-slide-y-transition>
            </v-col>
          </v-row>
        </v-container>
      </section>

      <!-- Footer -->
      <v-footer :class="isDark ? 'bg-dark' : ''" class="py-4">
        <v-container>
          <v-row>
            <v-col cols="12" class="text-center">
              <span :class="isDark ? 'text-medium-emphasis' : 'text-secondary'">
                © {{ new Date().getFullYear() }} Solid. All rights reserved.
              </span>
            </v-col>
          </v-row>
        </v-container>
      </v-footer>
    </v-main>
  </v-app>
</template>

<script setup>
import { computed } from 'vue'
import { useTheme } from 'vuetify'
import NavBar from '@/components/NavBar.vue'

const theme = useTheme()
const isDark = computed(() => theme.global.current.value.dark)

const features = [
  {
    icon: 'mdi-credit-card-outline',
    title: 'Secure Payments',
    description: 'Your data and transactions are protected with industry-standard encryption and trusted payment gateways.'
  },
  {
    icon: 'mdi-truck',
    title: 'Fast & Reliable Shipping',
    description: 'We deliver your orders quickly and safely, with real-time tracking and multiple delivery options.'
  },
  {
    icon: 'mdi-cart-arrow-up',
    title: 'Wide Product Range',
    description: 'From gadgets to fashion — find everything you need in one place, all at competitive prices.'
  }
]
</script>

<style scoped>
.bg-dark {
  background-color: rgb(17, 24, 39) !important;
}

.bg-dark-lighter {
  background-color: rgb(31, 41, 55) !important;
}

.text-medium-emphasis {
  color: rgba(235, 235, 235, 0.6);
}

.gap-4 {
  gap: 1rem;
}

/* Hero animations */
.hero-content {
  overflow: hidden;
}

.hero-image {
  animation: fadeInRight 0.8s ease-out;
}

/* Feature card animations */
.feature-card {
  transition: transform 0.3s ease, box-shadow 0.3s ease;
  animation: fadeInUp 0.6s ease-out forwards;
  opacity: 0;
}

.feature-card:hover {
  transform: translateY(-5px);
}

.feature-icon {
  transition: transform 0.3s ease;
}

.feature-card:hover .feature-icon {
  transform: scale(1.1);
}

/* Button animations */
.action-btn {
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.action-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2) !important;
}

/* Staggered animations */
.animate-in {
  animation: fadeInUp 0.6s ease-out forwards;
}

.animate-in-delay-1 {
  animation: fadeInUp 0.6s ease-out 0.2s forwards;
  opacity: 0;
}

.animate-in-delay-2 {
  animation: fadeInUp 0.6s ease-out 0.4s forwards;
  opacity: 0;
}

.animate-in-delay-3 {
  animation: fadeInUp 0.6s ease-out 0.6s forwards;
  opacity: 0;
}

/* Keyframe animations */
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes fadeInRight {
  from {
    opacity: 0;
    transform: translateX(20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}
</style> 