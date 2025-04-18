<template>
  <v-container class="fill-height" fluid>
    <v-row align="center" justify="center">
      <v-col cols="12" sm="8" md="4">
        <v-card class="elevation-12">
          <v-toolbar color="primary" dark flat>
            <v-toolbar-title>Create Account</v-toolbar-title>
          </v-toolbar>
          <v-card-text>
            <v-form @submit.prevent="handleSignup">
              <v-text-field
                v-model="name"
                label="Full Name"
                name="name"
                prepend-icon="mdi-account"
                type="text"
                required
              ></v-text-field>

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

              <v-text-field
                v-model="confirmPassword"
                label="Confirm Password"
                name="confirmPassword"
                prepend-icon="mdi-lock-check"
                :type="showConfirmPassword ? 'text' : 'password'"
                :append-icon="showConfirmPassword ? 'mdi-eye' : 'mdi-eye-off'"
                @click:append="showConfirmPassword = !showConfirmPassword"
                required
              ></v-text-field>

              <v-select
                v-model="role"
                :items="roles"
                label="Account Type"
                prepend-icon="mdi-account-tie"
                required
              ></v-select>

              <v-btn
                color="primary"
                type="submit"
                block
                class="mt-4"
              >
                Create Account
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
              Already have an account?
              <router-link to="/login" class="text-primary">Login</router-link>
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
  name: 'Signup',
  components: {
    SocialLogin
  },
  data() {
    return {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
      role: 'buyer',
      showPassword: false,
      showConfirmPassword: false,
      roles: [
        { title: 'Buyer', value: 'buyer' },
        { title: 'Seller', value: 'seller' }
      ]
    };
  },
  methods: {
    async handleSignup() {
      if (this.password !== this.confirmPassword) {
        alert('Passwords do not match');
        return;
      }

      try {
        const response = await authService.register({
          fullName: this.name,
          email: this.email,
          password: this.password,
          role: this.role
        });
        console.log('Signup response:', response);
        authService.setToken(response.token);
        this.$router.push('/');
      } catch (error) {
        console.error('Signup error:', error);
        alert(error.message || 'Signup failed');
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
.signup-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background-color: #f5f5f5;
}

.signup-card {
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

.signup-form {
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

input, select {
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1rem;
}

input:focus, select:focus {
  outline: none;
  border-color: #4a90e2;
}

.signup-button {
  background-color: #4a90e2;
  color: white;
  padding: 0.75rem;
  border: none;
  border-radius: 4px;
  font-size: 1rem;
  cursor: pointer;
  transition: background-color 0.3s ease;
  margin-top: 1rem;
}

.signup-button:hover {
  background-color: #357abd;
}

.login-link {
  text-align: center;
  margin-top: 1rem;
  color: #666;
}

.login-link a {
  color: #4a90e2;
  text-decoration: none;
}

.login-link a:hover {
  text-decoration: underline;
}
</style>