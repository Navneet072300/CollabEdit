terraform {
  backend "s3" {
    bucket         = "collabedit-terraform-state"
    key            = "eks/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "collabedit-terraform-locks"
    encrypt        = true
  }
}
