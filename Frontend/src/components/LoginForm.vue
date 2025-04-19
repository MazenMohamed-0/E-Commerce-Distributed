<template>
  <v-form @submit.prevent="submit" ref="form">
    <v-text-field
      v-model="email"
      label="Email"
      type="email"
      :rules="[rules.required, rules.email]"
      prepend-inner-icon="mdi-email"
      variant="outlined"
      class="mb-4"
    ></v-text-field>
    <v-text-field
      v-model="password"
      label="Password"
      :type="showPassword ? 'text' : 'password'"
      :rules="[rules.required, rules.min]"
      prepend-inner-icon="mdi-lock"
      :append-inner-icon="showPassword ? 'mdi-eye-off' : 'mdi-eye'"
      @click:append-inner="togglePasswordVisibility"
      @blur="showPassword = false"
      variant="outlined"
      class="mb-4"
    ></v-text-field>
    <v-btn
      color="primary"
      type="submit"
      block
      :loading="loading"
    >
      Login
    </v-btn>
  </v-form>
</template>

<script>
export default {
  name: 'LoginForm',
  data() {
    return {
      email: '',
      password: '',
      showPassword: false,
      loading: false,
      rules: {
        required: (value) => !!value || 'Required.',
        email: (value) => {
          const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          return pattern.test(value) || 'Invalid email.';
        },
        min: (value) => value.length >= 6 || 'Min 6 characters.',
      },
    };
  },
  methods: {
    togglePasswordVisibility() {
      this.showPassword = !this.showPassword;
    },
    submit() {
      if (this.$refs.form.validate()) {
        this.loading = true;
        const credentials = {
          email: this.email,
          password: this.password,
        };
        this.$emit('login', credentials);
        this.loading = false;
      }
    },
  },
};
</script>