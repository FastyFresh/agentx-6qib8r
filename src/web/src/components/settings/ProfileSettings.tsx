import React, { useState, useEffect, useCallback, useMemo } from 'react'; // ^18.2.0
import { debounce } from 'lodash'; // ^4.17.21
import FormField from '../common/FormField';
import { useAuth } from '../../hooks/useAuth';
import { User, UserRole } from '../../types/auth.types';
import { Size } from '../../types/common.types';

// Interface for profile form data with validation states
interface ProfileFormData {
  name: string;
  email: string;
  picture: string;
  errors: Record<string, string>;
  isSubmitting: boolean;
  isDirty: boolean;
}

// Validation rules following security requirements
const validationRules = {
  emailPattern: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
  nameMinLength: 2,
  nameMaxLength: 50,
  allowedImageTypes: ['image/jpeg', 'image/png', 'image/webp']
} as const;

/**
 * ProfileSettings component for managing user profile information
 * Implements role-based access control and Material Design styling
 */
const ProfileSettings: React.FC = () => {
  const { user, isLoading, updateProfile } = useAuth();
  
  // Initialize form state with user data
  const [formData, setFormData] = useState<ProfileFormData>({
    name: user?.name || '',
    email: user?.email || '',
    picture: user?.picture || '',
    errors: {},
    isSubmitting: false,
    isDirty: false
  });

  // Update form when user data changes
  useEffect(() => {
    if (user) {
      setFormData(prev => ({
        ...prev,
        name: user.name,
        email: user.email,
        picture: user.picture
      }));
    }
  }, [user]);

  // Role-based field access control
  const fieldPermissions = useMemo(() => ({
    name: true, // All roles can edit name
    email: user?.role === UserRole.SUPER_ADMIN || user?.role === UserRole.ADMIN,
    picture: true // All roles can update picture
  }), [user?.role]);

  // Debounced validation function
  const validateField = useCallback(
    debounce(async (fieldName: string, value: string): Promise<string | null> => {
      switch (fieldName) {
        case 'name':
          if (!value.trim()) return 'Name is required';
          if (value.length < validationRules.nameMinLength) {
            return `Name must be at least ${validationRules.nameMinLength} characters`;
          }
          if (value.length > validationRules.nameMaxLength) {
            return `Name must be less than ${validationRules.nameMaxLength} characters`;
          }
          return null;

        case 'email':
          if (!value.trim()) return 'Email is required';
          if (!validationRules.emailPattern.test(value)) {
            return 'Please enter a valid email address';
          }
          return null;

        case 'picture':
          if (value && !validationRules.allowedImageTypes.includes(value.split(';')[0])) {
            return 'Invalid image format. Use JPEG, PNG, or WebP';
          }
          return null;

        default:
          return null;
      }
    }, 300),
    []
  );

  // Handle field changes with validation
  const handleFieldChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ): Promise<void> => {
    const { name, value } = event.target;

    // Check field permissions
    if (!fieldPermissions[name as keyof typeof fieldPermissions]) {
      return;
    }

    setFormData(prev => ({
      ...prev,
      [name]: value,
      isDirty: true
    }));

    // Validate field
    const error = await validateField(name, value);
    setFormData(prev => ({
      ...prev,
      errors: {
        ...prev.errors,
        [name]: error || ''
      }
    }));
  };

  // Handle form submission
  const handleSubmit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();

    // Validate all fields before submission
    const validationPromises = Object.entries(formData)
      .filter(([key]) => key !== 'errors' && key !== 'isSubmitting' && key !== 'isDirty')
      .map(async ([key, value]) => {
        const error = await validateField(key, value as string);
        return { key, error };
      });

    const validationResults = await Promise.all(validationPromises);
    const errors: Record<string, string> = {};
    validationResults.forEach(({ key, error }) => {
      if (error) errors[key] = error;
    });

    if (Object.keys(errors).length > 0) {
      setFormData(prev => ({
        ...prev,
        errors
      }));
      return;
    }

    try {
      setFormData(prev => ({
        ...prev,
        isSubmitting: true
      }));

      const updatedProfile = {
        name: formData.name,
        email: formData.email,
        picture: formData.picture
      };

      await updateProfile(updatedProfile);

      setFormData(prev => ({
        ...prev,
        isSubmitting: false,
        isDirty: false,
        errors: {}
      }));
    } catch (error) {
      setFormData(prev => ({
        ...prev,
        isSubmitting: false,
        errors: {
          ...prev.errors,
          submit: 'Failed to update profile. Please try again.'
        }
      }));
    }
  };

  if (isLoading) {
    return <div aria-busy="true">Loading profile settings...</div>;
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="profile-settings"
      aria-label="Profile Settings"
    >
      <FormField
        label="Name"
        required
        size={Size.MEDIUM}
        error={formData.errors.name}
        disabled={!fieldPermissions.name || formData.isSubmitting}
      >
        <input
          type="text"
          name="name"
          value={formData.name}
          onChange={handleFieldChange}
          aria-required="true"
          disabled={!fieldPermissions.name || formData.isSubmitting}
        />
      </FormField>

      <FormField
        label="Email"
        required
        size={Size.MEDIUM}
        error={formData.errors.email}
        disabled={!fieldPermissions.email || formData.isSubmitting}
      >
        <input
          type="email"
          name="email"
          value={formData.email}
          onChange={handleFieldChange}
          aria-required="true"
          disabled={!fieldPermissions.email || formData.isSubmitting}
        />
      </FormField>

      <FormField
        label="Profile Picture"
        size={Size.MEDIUM}
        error={formData.errors.picture}
        disabled={!fieldPermissions.picture || formData.isSubmitting}
      >
        <input
          type="file"
          name="picture"
          accept={validationRules.allowedImageTypes.join(',')}
          onChange={handleFieldChange}
          disabled={!fieldPermissions.picture || formData.isSubmitting}
        />
      </FormField>

      {formData.errors.submit && (
        <div role="alert" className="error-message">
          {formData.errors.submit}
        </div>
      )}

      <button
        type="submit"
        disabled={!formData.isDirty || formData.isSubmitting}
        aria-busy={formData.isSubmitting}
      >
        {formData.isSubmitting ? 'Saving...' : 'Save Changes'}
      </button>
    </form>
  );
};

export default ProfileSettings;