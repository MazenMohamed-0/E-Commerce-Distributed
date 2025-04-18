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
              <router-link to="/signup" class="text-primary">Sign up</router-link>
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
.login-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background-color: #f5f5f5;
}

.login-card {
  background: white;
  padding: 2rem;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  width: 100%;
  max-width: 400px;
}

h2 {
  text-align: center;
  margin-bottom: 1.5rem;
  color: #333;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

label {
  font-weight: 500;
  color: #666;
}

input {
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1rem;
}

input:focus {
  outline: none;
  border-color: #4a90e2;
}

.login-button {
  background-color: #4a90e2;
  color: white;
  padding: 0.75rem;
  border: none;
  border-radius: 4px;
  font-size: 1rem;
  cursor: pointer;
  transition: background-color 0.3s ease;
}

.login-button:hover {
  background-color: #357abd;
}

.register-link {
  text-align: center;
  margin-top: 1rem;
  color: #666;
}

.register-link a {
  color: #4a90e2;
  text-decoration: none;
}

.register-link a:hover {
  text-decoration: underline;
}
</style>