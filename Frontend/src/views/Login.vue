<template>
  <v-container class="fill-height" fluid>
    <v-row align="center" justify="center">
      <v-col cols="12" sm="8" md="4">
        <v-card class="elevation-12">
          <v-toolbar color="primary" dark flat>
            <v-toolbar-title>Login</v-toolbar-title>
          </v-toolbar>
          <v-card-text>
            <v-form @submit.prevent="handleLogin">
              <v-text-field
                v-model="email"
                label="Email"
                name="email"
                prepend-icon="mdi-email"
                type="email"
                required
              ></v-text-field>

              <v-text-field
                v-model="password"
                label="Password"
                name="password"
                prepend-icon="mdi-lock"
                :type="showPassword ? 'text' : 'password'"
                :append-icon="showPassword ? 'mdi-eye' : 'mdi-eye-off'"
                @click:append="showPassword = !showPassword"
                required
              ></v-text-field>

              <v-btn
                color="primary"
                type="submit"
                block
                class="mt-4"
              >
                Login
              </v-btn>
            </v-form>

            <v-divider class="my-4"></v-divider>

            <SocialLogin
              @login-success="handleSocialLoginSuccess"
              @login-error="handleSocialLoginError"
            />
          </v-card-text>
          <v-card-actions class="px-4 pb-4">
            <v-spacer></v-spacer>
            <span class="text-body-2">
              Don't have an account?
              <router-link to="/Signup" class="text-primary">Sign up</router-link>
            </span>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script>
import { authService } from '@/api/authService';
import SocialLogin from '@/components/SocialLogin.vue';
import NavBar from '@/components/NavBar.vue'


export default {
  name: 'Login',
  components: {
    SocialLogin
  },
  data() {
    return {
      email: '',
      password: '',
      showPassword: false
    };
  },
  methods: {
    async handleLogin() {
      // Validate required fields
      if (!this.email || !this.password) {
        alert('Please fill in all required fields');
        return;
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(this.email)) {
        alert('Please enter a valid email address');
        return;
      }

      try {
        const response = await authService.login({
          email: this.email,
          password: this.password
        });
        console.log('Login response:', response);
        authService.setToken(response.token);
        this.$router.push('/');
      } catch (error) {
        console.error('Login error:', error);
        // Show more specific error message from the backend
        const errorMessage = error.response?.data?.message || 
                           (error.response?.status === 401 ? 'Invalid email or password' : 'Login failed');
        alert(errorMessage);
      }
    },
    handleSocialLoginSuccess(token) {
      authService.setToken(token);
      this.$router.push('/');
    },
    handleSocialLoginError(error) {
      alert(error || 'Social login failed');
    }
  }
};
</script>

<style scoped>
.bg-dark {
  background-color: rgb(17, 24, 39) !important;
}

.text-medium-emphasis {
  color: rgba(235, 235, 235, 0.6);
}

.v-btn {
  text-transform: none;
}

/* Card animation */
.login-card {
  animation: fadeInUp 0.6s ease-out;
}

/* Input field animations */
.input-field {
  transition: transform 0.3s ease, opacity 0.3s ease;
}

.input-field:focus-within {
  transform: translateY(-2px);
}

/* Feature icon animation */
.feature-icon {
  transition: transform 0.3s ease;
}

.feature:hover .feature-icon {
  transform: scale(1.1);
}

/* Button animations */
.submit-btn {
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.submit-btn:not(:disabled):hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
}

.link-btn {
  transition: opacity 0.3s ease;
}

.link-btn:hover {
  opacity: 0.8;
}

.social-btn {
  transition: all 0.3s ease;
}

.social-btn:hover {
  transform: translateY(-2px);
  opacity: 0.9;
}

/* Checkbox animation */
.checkbox-field {
  transition: opacity 0.3s ease;
}

.checkbox-field:hover {
  opacity: 0.9;
}

/* Feature stagger animation */
.feature {
  opacity: 0;
  animation: fadeIn 0.6s ease-out forwards;
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

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>