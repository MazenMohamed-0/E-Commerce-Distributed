<template>
  <v-form @submit.prevent="submit" ref="form">
    <v-text-field
      v-model="name"
      label="Name"
      type="text"
      :rules="[rules.required]"
      prepend-inner-icon="mdi-account"
      variant="outlined"
      class="mb-4"
    ></v-text-field>
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
      @click:append-inner="showPassword = !showPassword"
      @blur="showPassword = false"
      variant="outlined"
      class="mb-4"
    ></v-text-field>
    <v-text-field
      v-model="confirmPassword"
      label="Confirm Password"
      :type="showConfirmPassword ? 'text' : 'password'"
      :rules="[rules.required, rules.passwordMatch]"
      prepend-inner-icon="mdi-lock-check"
      :append-inner-icon="showConfirmPassword ? 'mdi-eye-off' : 'mdi-eye'"
      @click:append-inner="showConfirmPassword = !showConfirmPassword"
      @blur="showConfirmPassword = false"
      variant="outlined"
      class="mb-4"
    ></v-text-field>
    <v-btn
      color="primary"
      type="submit"
      block
      :loading="loading"
    >
      Sign Up
    </v-btn>
  </v-form>
</template>

<script>
export default {
name: 'SignupForm',
data() {
  return {
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    showPassword: false,
    showConfirmPassword: false,
    loading: false,
    rules: {
      required: value => !!value || 'Required.',
      email: value => {
        const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return pattern.test(value) || 'Invalid email.';
      },
      min: value => value.length >= 6 || 'Min 6 characters.',
      passwordMatch: value => value === this.password || 'Passwords must match.'
    },
  };
},
methods: {
  submit() {
    if (this.$refs.form.validate()) {
      this.loading = true;
      const userData = {
        name: this.name,
        email: this.email,
        password: this.password,
      };
      this.$emit('signup', userData);
      this.loading = false;
    }
  },
},
};
</script>