import React, { useState } from 'react'
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  Button,
  FormControl,
  FormLabel,
  Input,
  useToast,
  Text,
} from '@chakra-ui/react'

interface PasswordModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (password: string) => void
  title: string
  description: string
}

const PasswordModal: React.FC<PasswordModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  title,
  description, // Use the description prop here
}) => {
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const toast = useToast()

  const handleSubmit = async () => {
    if (!password.trim()) {
      toast({
        title: 'Password Required.',
        description: 'Please enter your password.',
        status: 'warning',
        duration: 3000,
        isClosable: true,
      })
      return
    }

    setIsSubmitting(true)
    try {
      await onSubmit(password)
      setPassword('') // Clear password after successful submission
    } catch (error) {
      console.error('Error in password modal submit:', error)
      toast({
        title: 'Submission Error.',
        description: (error as Error).message || 'An unexpected error occurred.',
        status: 'error',
        duration: 5000,
        isClosable: true,
      })
    } finally {
      setIsSubmitting(false)
      // Optionally close the modal here if onSubmit handles success/failure states
      // onClose(); // Or let the parent component control closing
    }
  }

  const handleClose = () => {
    setPassword('') // Clear password when closing
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} isCentered>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>{title}</ModalHeader>
        <ModalCloseButton />
        <ModalBody pb={6}>
          {/* Use the Text component here */}
          <Text mb={4}>{description}</Text>
          <FormControl isRequired>
            <FormLabel htmlFor="password">Password</FormLabel>
            <Input
              id="password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoFocus
            />
          </FormControl>
        </ModalBody>

        <ModalFooter>
          <Button onClick={handleClose} mr={3} variant="outline">
            Cancel
          </Button>
          <Button colorScheme="blue" onClick={handleSubmit} isLoading={isSubmitting}>
            Submit
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

export default PasswordModal
