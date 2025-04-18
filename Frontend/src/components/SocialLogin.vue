<template>
  <div class="social-login">
    <v-divider class="my-4">
      <span class="text-caption">Or continue with</span>
    </v-divider>
    
    <v-row>
      <v-col cols="12">
        <v-btn
          block
          color="white"
          class="mb-2"
          @click="handleGoogleLogin"
        >
          <v-icon left>mdi-google</v-icon>
          Continue with Google
        </v-btn>
      </v-col>
      <v-col cols="12">
        <v-btn
          block
          color="blue darken-3"
          dark
          @click="handleFacebookLogin"
        >
          <v-icon left>mdi-facebook</v-icon>
          Continue with Facebook
        </v-btn>
      </v-col>
    </v-row>
  </div>
</template>

<script>
import { authService } from '@/api/authService';

export default {
  name: 'SocialLogin',
  methods: {
    async handleGoogleLogin() {
      try {
        const token = await authService.googleLogin();
        authService.setToken(token);
        this.$emit('login-success', token);
      } catch (error) {
        this.$emit('login-error', error.message);
      }
    },
    async handleFacebookLogin() {
      try {
        const token = await authService.facebookLogin();
        authService.setToken(token);
        this.$emit('login-success', token);
      } catch (error) {
        this.$emit('login-error', error.message);
      }
    }
  }
};
</script>

<style scoped>
.social-login {
  width: 100%;
  margin-top: 20px;
}

.divider {
  display: flex;
  align-items: center;
  text-align: center;
  margin: 20px 0;
}

.divider::before,
.divider::after {
  content: '';
  flex: 1;
  border-bottom: 1px solid #e0e0e0;
}

.divider span {
  padding: 0 10px;
  color: #666;
  font-size: 14px;
}

.social-buttons {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.social-button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 10px;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  background: white;
  cursor: pointer;
  transition: all 0.3s ease;
  width: 100%;
}

.social-button:hover {
  background: #f5f5f5;
}

.social-button img {
  width: 20px;
  height: 20px;
}

.social-button.google {
  color: #757575;
}

.social-button.facebook {
  color: #1877f2;
}
</style> 